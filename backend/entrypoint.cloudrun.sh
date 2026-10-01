#!/bin/sh
set -e

wait_for_database() {
  if [ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]; then
    echo "Waiting for Cloud SQL socket..."
    python -c "
import os, time
conn = os.environ['CLOUD_SQL_CONNECTION_NAME']
path = os.path.join('/cloudsql', conn)
for _ in range(90):
    if os.path.exists(path):
        break
    time.sleep(2)
else:
    raise SystemExit('Cloud SQL socket not found: ' + path)
"
    return
  fi

  _host="${MYSQL_HOST:-}"
  _port="${MYSQL_PORT:-3306}"
  if [ -z "$_host" ]; then
    echo "ERROR: MYSQL_HOST is not set."
    echo "       On Render: open env group tikitaka-data and set MYSQL_HOST to your external"
    echo "       MySQL hostname (not \"mysql\"). Also set MYSQL_USER and MYSQL_PASSWORD, then redeploy."
    exit 1
  fi
  if [ "$_host" = "mysql" ] && [ -n "${RENDER_SERVICE_ID:-}${RENDER:-}" ]; then
    echo "ERROR: MYSQL_HOST is \"mysql\" (Docker Compose only). Set your external DB hostname in tikitaka-data."
    exit 1
  fi

  echo "Waiting for MySQL at ${_host}:${_port}..."
  _attempt=0
  while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('$_host', int('$_port'))); s.close()" 2>/dev/null; do
    _attempt=$(( _attempt + 1 ))
    if [ "$_attempt" -ge 90 ]; then
      echo "ERROR: MySQL not reachable at ${_host}:${_port} after 3 minutes."
      echo "       Check MYSQL_* values, DB firewall, and that the host allows public connections."
      exit 1
    fi
    sleep 2
  done
}

wait_for_database

python manage.py migrate --noinput
python manage.py collectstatic --noinput 2>/dev/null || true

WORKERS="${GUNICORN_WORKERS:-1}"
exec gunicorn tikitaka.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
