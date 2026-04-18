# -*- coding: utf-8 -*-
"""
fix_channels_schema.py
Adds missing columns to channels table and re-runs the LinkedIn group insert.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD
import psycopg2

PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]
DSN = (f"host=db.{PROJECT_REF}.supabase.co port=5432 dbname=postgres "
       f"user=postgres password={SUPABASE_DB_PASSWORD} sslmode=require")

conn = psycopg2.connect(DSN)
cur = conn.cursor()

# 1. Check existing columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='channels'
    ORDER BY ordinal_position;
""")
cols = [r[0] for r in cur.fetchall()]
print("Existing columns:", cols)

# 2. Add missing columns
needed = {
    "url":            "TEXT UNIQUE",
    "activity_score": "INTEGER",
    "scraper_type":   "TEXT DEFAULT 'manual'",
    "members_count":  "INTEGER",
    "last_scraped_at":"TIMESTAMPTZ",
    "last_content":   "JSONB",
}
for col, typedef in needed.items():
    if col not in cols:
        cur.execute(f"ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS {col} {typedef};")
        print(f"  Added column: {col}")
    else:
        print(f"  OK: {col}")

conn.commit()

# 3. Verify
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='channels'
    ORDER BY ordinal_position;
""")
cols_after = [r[0] for r in cur.fetchall()]
print("\nColumns after fix:", cols_after)

cur.close()
conn.close()
print("\n✅ Schema fixed. Run linkedin_group_discovery.py again.")
