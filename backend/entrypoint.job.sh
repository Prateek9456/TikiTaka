#!/bin/sh
set -e

wait_for_database() {
  if [ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]; then
    python -c "
import os, time
path = os.path.join('/cloudsql', os.environ['CLOUD_SQL_CONNECTION_NAME'])
for _ in range(90):
    if os.path.exists(path):
        break
    time.sleep(2)
else:
    raise SystemExit('Cloud SQL socket not found')
"
    return
  fi

  _host="${MYSQL_HOST:-}"
  _port="${MYSQL_PORT:-3306}"
  if [ -z "$_host" ]; then
    echo "ERROR: MYSQL_HOST is not set."
    exit 1
  fi

  _attempt=0
  while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('$_host', int('$_port'))); s.close()" 2>/dev/null; do
    _attempt=$(( _attempt + 1 ))
    if [ "$_attempt" -ge 90 ]; then
      echo "ERROR: MySQL not reachable at ${_host}:${_port} after 3 minutes."
      exit 1
    fi
    sleep 2
  done
}

wait_for_database

python manage.py migrate --noinput
exec python manage.py run_ingestion_job --task "${INGESTION_JOB:-scheduled}"
