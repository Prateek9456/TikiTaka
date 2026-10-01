#!/bin/sh
set -e

# Render-specific entrypoint.
# Requires MYSQL_HOST (external DB — not "mysql") to be set in tikitaka-data env group.

_host="${MYSQL_HOST:-}"
_port="${MYSQL_PORT:-3306}"

if [ -z "$_host" ]; then
  echo "ERROR: MYSQL_HOST is not set."
  echo "       Dashboard → Env Groups → tikitaka-data → set MYSQL_HOST to your external MySQL hostname."
  echo "       Also ensure MYSQL_USER and MYSQL_PASSWORD are set, then redeploy."
  exit 1
fi

if [ "$_host" = "mysql" ]; then
  echo "ERROR: MYSQL_HOST is \"mysql\" — that is the Docker Compose service name, not valid on Render."
  echo "       Set MYSQL_HOST to your external DB hostname (e.g. PlanetScale, Aiven, Railway)."
  exit 1
fi

echo "Waiting for MySQL at ${_host}:${_port}..."
_attempt=0
while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('$_host', int('$_port'))); s.close()" 2>/dev/null; do
  _attempt=$(( _attempt + 1 ))
  if [ "$_attempt" -ge 90 ]; then
    echo "ERROR: MySQL not reachable at ${_host}:${_port} after 3 minutes."
    echo "       Check MYSQL_* env vars, DB firewall rules, and that the host allows public connections."
    exit 1
  fi
  sleep 2
done

echo "MySQL is up — running migrations..."
python manage.py migrate --noinput
python manage.py collectstatic --noinput 2>/dev/null || true

WORKERS="${GUNICORN_WORKERS:-1}"
echo "Starting Gunicorn with ${WORKERS} worker(s) on port ${PORT:-8080}..."
exec gunicorn tikitaka.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
