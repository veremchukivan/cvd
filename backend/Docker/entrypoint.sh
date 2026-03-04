#!/bin/sh
set -e

cd /app/backend

# Wait for PostgreSQL to become reachable before running migrations
echo "Waiting for database..."
python - <<'PY'
import os, time, sys
import psycopg2

url = os.environ.get("DATABASE_URL")
if not url:
    print("DATABASE_URL not set; skipping wait")
    sys.exit(0)

for attempt in range(30):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("Database is ready")
        sys.exit(0)
    except Exception as exc:
        print(f"DB not ready (attempt {attempt+1}/30): {exc}")
        time.sleep(2)

print("Database did not become ready in time", file=sys.stderr)
sys.exit(1)
PY

python manage.py migrate --noinput

exec "$@"
