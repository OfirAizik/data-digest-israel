"""
run_setup_sql.py
Connects to Supabase via direct Postgres and runs new_project_setup.sql.
Uses psycopg2 because the supabase-py client does not support DDL over REST.
"""
import sys
import subprocess

# Install dependencies if missing
for pkg in ("psycopg2-binary",):
    try:
        __import__(pkg.replace("-", "_").split("-")[0])
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

import psycopg2

# ── credentials ──────────────────────────────────────────────────
from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD

# Derive project ref from URL: https://<ref>.supabase.co
project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]

DSN = (
    f"host=db.{project_ref}.supabase.co "
    f"port=5432 "
    f"dbname=postgres "
    f"user=postgres "
    f"password={SUPABASE_DB_PASSWORD} "
    f"sslmode=require"
)

SQL_FILE = "new_project_setup.sql"

# ── run ───────────────────────────────────────────────────────────
def main():
    with open(SQL_FILE, "r", encoding="utf-8") as f:
        sql = f.read()

    print(f"Connecting to db.{project_ref}.supabase.co …")
    conn = psycopg2.connect(DSN)
    conn.autocommit = True          # DDL statements need autocommit
    cur = conn.cursor()

    print(f"Running {SQL_FILE} …")
    cur.execute(sql)

    cur.close()
    conn.close()
    print("Done. All tables created successfully.")

if __name__ == "__main__":
    main()
