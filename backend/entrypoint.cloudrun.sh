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

  echo "Waiting for MySQL at ${MYSQL_HOST:-mysql}:${MYSQL_PORT:-3306}..."
  while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('${MYSQL_HOST:-mysql}', int('${MYSQL_PORT:-3306}'))); s.close()" 2>/dev/null; do
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
