#!/bin/sh
set -e

_host="${MYSQL_HOST:-}"
_port="${MYSQL_PORT:-3306}"

if [ -z "$_host" ]; then
  echo "ERROR: MYSQL_HOST is not set."
  echo "       Dashboard -> Env Groups -> tikitaka-data -> set MYSQL_HOST."
  exit 1
fi

if [ "$_host" = "mysql" ]; then
  echo "ERROR: MYSQL_HOST is 'mysql' -- Docker Compose default, not valid on Render."
  exit 1
fi

echo "Waiting for MySQL at ${_host}:${_port}..."
_attempt=0
while ! python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('$_host', int('$_port'))); s.close()" 2>/dev/null; do
  _attempt=$(( _attempt + 1 ))
  if [ "$_attempt" -ge 90 ]; then
    echo "ERROR: MySQL not reachable at ${_host}:${_port} after 3 minutes."
    exit 1
  fi
  sleep 2
done

echo "MySQL is up -- testing connection before migrate..."

# Write the diagnostic script to a temp file to avoid shell quote mangling
cat > /tmp/dbcheck.py << 'PYEOF'
import os, sys
import pymysql

host = os.environ.get('MYSQL_HOST', '')
port = int(os.environ.get('MYSQL_PORT', '3306'))
user = os.environ.get('MYSQL_USER', '')
pw   = os.environ.get('MYSQL_PASSWORD', '')
db   = os.environ.get('MYSQL_DATABASE', 'test')

masked = '*' * len(pw)
print(f'  HOST={host}')
print(f'  PORT={port}')
print(f'  USER={user}')
print(f'  PASS={masked} (len={len(pw)})')
print(f'  DB  ={db}')

# Try with SSL first (required by TiDB Cloud)
try:
    c = pymysql.connect(
        host=host, port=port, user=user, password=pw, database=db,
        ssl_verify_cert=True, ssl_verify_identity=True
    )
    print('  [OK] Connected with SSL:', c.get_server_info())
    c.close()
    sys.exit(0)
except Exception as e:
    print(f'  [FAIL] SSL connection failed: {e}')

# Try without SSL to distinguish SSL vs credential issue
try:
    c2 = pymysql.connect(host=host, port=port, user=user, password=pw, database=db)
    print('  [INFO] Non-SSL connection worked -- SSL config is the issue')
    c2.close()
except Exception as e2:
    print(f'  [FAIL] Non-SSL also failed: {e2}')

sys.exit(1)
PYEOF

python /tmp/dbcheck.py

echo "Running migrations..."
python manage.py migrate --noinput --fake-initial
python manage.py collectstatic --noinput 2>/dev/null || true

WORKERS="${GUNICORN_WORKERS:-1}"
echo "Starting Gunicorn with ${WORKERS} worker(s) on port ${PORT:-8080}..."
exec gunicorn tikitaka.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
