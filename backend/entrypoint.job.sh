#!/bin/sh
set -e

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
else
  while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('${MYSQL_HOST:-mysql}', int('${MYSQL_PORT:-3306}'))); s.close()" 2>/dev/null; do
    sleep 2
  done
fi

python manage.py migrate --noinput
exec python manage.py run_ingestion_job --task "${INGESTION_JOB:-scheduled}"
