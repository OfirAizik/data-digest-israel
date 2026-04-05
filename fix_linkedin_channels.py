"""
fix_linkedin_channels.py
1. Deletes LinkedIn channels with no URL.
2. Shows first 10 LinkedIn channels that have URLs.

Reads credentials from secrets.py (same pattern as run_setup_sql.py).
"""
import sys
import subprocess

for pkg in ("psycopg2-binary",):
    try:
        import psycopg2
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])
        import psycopg2

from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD

project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]
DSN = (
    f"host=db.{project_ref}.supabase.co "
    f"port=5432 dbname=postgres user=postgres "
    f"password={SUPABASE_DB_PASSWORD} sslmode=require"
)

conn = psycopg2.connect(DSN)
conn.autocommit = True
cur = conn.cursor()

# 1. Delete LinkedIn channels with no URL
cur.execute("""
    DELETE FROM public.channels
    WHERE platform = 'linkedin'
      AND (url IS NULL OR url = '')
    RETURNING name
""")
deleted = cur.fetchall()
print(f"\nDeleted {len(deleted)} LinkedIn channel(s) with no URL:")
for row in deleted:
    print(f"  - {row[0]}")

# 2. Show first 10 LinkedIn channels that have URLs
cur.execute("""
    SELECT name, url, is_active
    FROM public.channels
    WHERE platform = 'linkedin'
      AND url IS NOT NULL
      AND url != ''
    ORDER BY name
    LIMIT 10
""")
rows = cur.fetchall()
print(f"\nFirst {len(rows)} LinkedIn channel(s) with URLs:")
print(f"  {'Name':<40} {'URL':<50} {'Active'}")
print(f"  {'-'*40} {'-'*50} {'-'*6}")
for name, url, is_active in rows:
    print(f"  {str(name):<40} {str(url):<50} {is_active}")

cur.close()
conn.close()
