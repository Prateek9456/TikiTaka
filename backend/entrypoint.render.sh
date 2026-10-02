#!/bin/sh
set -e

_host="${MYSQL_HOST:-}"
_port="${MYSQL_PORT:-3306}"

if [ -z "$_host" ]; then
  echo "ERROR: MYSQL_HOST is not set."
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

echo "MySQL is up -- wiping stale tables and running migrations..."

cat > /tmp/reset_and_migrate.py << 'PYEOF'
import os, sys, subprocess
import pymysql

host = os.environ['MYSQL_HOST']
port = int(os.environ.get('MYSQL_PORT', '3306'))
user = os.environ['MYSQL_USER']
pw   = os.environ['MYSQL_PASSWORD']
db   = os.environ.get('MYSQL_DATABASE', 'test')

ssl_kwargs = {}
if 'tidbcloud.com' in host:
    ssl_kwargs = {'ssl_verify_cert': True, 'ssl_verify_identity': True}

print(f"Connecting to {host}:{port} db={db} user={user}")
conn = pymysql.connect(host=host, port=port, user=user, password=pw,
                       database=db, **ssl_kwargs)

with conn.cursor() as cur:
    # Check if any Django-managed tables already exist
    cur.execute("SHOW TABLES")
    tables = [row[0] for row in cur.fetchall()]

if tables:
    print(f"Found {len(tables)} existing tables — dropping all to ensure clean migration...")
    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for t in tables:
            cur.execute(f"DROP TABLE IF EXISTS `{t}`")
            print(f"  Dropped: {t}")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()
    print("All tables dropped. Running migrations on clean database...")
else:
    print("Clean database — running migrations...")

conn.close()

result = subprocess.run(
    ["python", "manage.py", "migrate", "--noinput"],
    check=False
)
sys.exit(result.returncode)
PYEOF

python /tmp/reset_and_migrate.py
python manage.py collectstatic --noinput 2>/dev/null || true

WORKERS="${GUNICORN_WORKERS:-1}"
echo "Starting Gunicorn with ${WORKERS} worker(s) on port ${PORT:-8080}..."
exec gunicorn tikitaka.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${WORKERS}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
