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

# Ensure target database exists
try:
    init_conn = pymysql.connect(host=host, port=port, user=user, password=pw, **ssl_kwargs)
    with init_conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db}`")
    init_conn.commit()
    init_conn.close()
except Exception as e:
    print(f"Note: Could not run CREATE DATABASE (may already exist or lack permission): {e}")

print(f"Connecting to {host}:{port} db={db} user={user}")
conn = pymysql.connect(host=host, port=port, user=user, password=pw,
                       database=db, **ssl_kwargs)

with conn.cursor() as cur:
    cur.execute("SHOW TABLES")
    tables = [row[0] for row in cur.fetchall()]

force_reset = os.environ.get("RESET_DB", "false").lower() in ("1", "true", "yes")
should_clean = force_reset

if tables and not force_reset:
    if "django_migrations" not in tables:
        should_clean = True
    else:
        # Check if migrations completed successfully previously (django_celery_beat & matches)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM django_migrations WHERE app IN ('django_celery_beat', 'matches')")
            if cur.fetchone()[0] == 0:
                # Tables exist but failed mid-way previously
                should_clean = True

if should_clean:
    print(f"Found orphaned/incomplete tables ({len(tables)}) — cleaning up for fresh migration...")
    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for t in tables:
            cur.execute(f"DROP TABLE IF EXISTS `{t}`")
            print(f"  Dropped: {t}")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()
    print("Orphaned tables dropped. Running migrations on clean database...")
else:
    print(f"Database ready ({len(tables)} tables) — running migrations...")

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
