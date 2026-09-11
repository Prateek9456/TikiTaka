#!/bin/sh
set -e

echo "Waiting for MySQL..."
while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('${MYSQL_HOST:-mysql}', int('${MYSQL_PORT:-3306}'))); s.close()" 2>/dev/null; do
  sleep 2
done

python manage.py migrate --noinput
python manage.py collectstatic --noinput 2>/dev/null || true

if [ "${RUN_KAFKA_CONSUMERS:-false}" = "true" ]; then
  python manage.py run_kafka_consumers &
fi

if [ "${RUN_CELERY:-false}" = "true" ]; then
  celery -A tikitaka worker -l info &
  celery -A tikitaka beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler &
fi

exec gunicorn tikitaka.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 4 --timeout 120
