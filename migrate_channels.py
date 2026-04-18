# -*- coding: utf-8 -*-
import psycopg2
from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD

project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]
DSN = (
    f"host=db.{project_ref}.supabase.co port=5432 dbname=postgres "
    f"user=postgres password={SUPABASE_DB_PASSWORD} sslmode=require"
)

conn = psycopg2.connect(DSN)
conn.autocommit = True
cur = conn.cursor()

# Add missing columns
print("Adding columns if missing...")
cur.execute("ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS activity_score INTEGER;")
cur.execute("ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS scraper_type TEXT DEFAULT 'manual';")
print("Columns ready.")

sources = [
    # telegram
    dict(platform="telegram", name="Machine & Deep Learning Israel (\u05e2\u05e8\u05d5\u05e5)", category="ML/DL/AI", url="MDLI1", active=True, activity=5),
    dict(platform="telegram", name="Machine & Deep Learning Israel (\u05e7\u05d1\u05d5\u05e6\u05d4)", category="ML/DL/AI", url="bit.ly/MDLIgroup", active=True, activity=5),
    # facebook
    dict(platform="facebook", name="Machine & Deep Learning Israel", category="ML/DL/AI", url="https://www.facebook.com/groups/MDLI1/", active=False, activity=5),
    dict(platform="facebook", name="Data Analytics Israel", category="BI/Analytics", url="https://www.facebook.com/groups/DataAnalyticsIsrael/", active=False, activity=5),
    dict(platform="facebook", name="Data Science Israel", category="Data Science", url="https://www.facebook.com/groups/DataScienceIsrael/", active=False, activity=4),
    dict(platform="facebook", name="AI ISRAEL \u2013 \u05db\u05dc\u05d9\u05dd \u05d5\u05e9\u05d9\u05de\u05d5\u05e9\u05d9\u05dd", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/aisrael/", active=False, activity=5),
    dict(platform="facebook", name="AI ISRAEL \u2013 ChatGPT & Midjourney", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/845334450251048/", active=False, activity=4),
    dict(platform="facebook", name="ChatGPT \u05d9\u05e9\u05e8\u05d0\u05dc \u05d4\u05e7\u05d4\u05d9\u05dc\u05d4", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/715153780127233/", active=False, activity=4),
    dict(platform="facebook", name="ChatGPT \u05d9\u05e9\u05e8\u05d0\u05dc \u2013 \u05e7\u05d4\u05d9\u05dc\u05d4 \u05e0\u05d5\u05e1\u05e4\u05ea", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/3347199695494901/", active=False, activity=3),
    dict(platform="facebook", name="Excel Pros Israel", category="BI/Analytics", url="https://www.facebook.com/groups/excelprosisrael/", active=False, activity=4),
    dict(platform="facebook", name="HACKIT.CO.IL \u2013 AI \u05d4\u05d0\u05e7\u05d9\u05e0\u05d2 \u05d5\u05e4\u05d9\u05ea\u05d5\u05d7", category="ML/DL/AI", url="https://www.facebook.com/groups/725144319132970/", active=False, activity=3),
    dict(platform="facebook", name="\u05d1\u05d9\u05e0\u05d4 \u05de\u05dc\u05d0\u05db\u05d5\u05ea\u05d9\u05ea \u05e9\u05dc \u05d3\u05e0\u05d4 \u05d9\u05e9\u05e8\u05d0\u05dc\u05d9", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/574653557886298/", active=False, activity=3),
    dict(platform="facebook", name="Gemini Israel", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/1266824747259615/", active=False, activity=2),
    dict(platform="facebook", name="Sora Israel \u2013 \u05d5\u05d9\u05d3\u05d0\u05d5 \u05d5\u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d4 AI", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/365817639698470/", active=False, activity=3),
    dict(platform="facebook", name="\u05d1\u05d9\u05e0\u05d4 \u05de\u05dc\u05d0\u05db\u05d5\u05ea\u05d9\u05ea \u05d1\u05e2\u05d5\u05dc\u05dd \u05d4\u05de\u05e9\u05e4\u05d8", category="CDO/\u05de\u05e0\u05d4\u05dc\u05d9\u05dd", url="https://www.facebook.com/groups/1087861915591003/", active=False, activity=2),
    dict(platform="facebook", name="AI Coffee Club Israel", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://www.facebook.com/groups/aicoffeeclub", active=False, activity=3),
    dict(platform="facebook", name="Machine & Deep Learning Jobs Israel", category="ML/DL/AI", url="https://www.facebook.com/groups/ml.jobs.il/", active=False, activity=4),
    # linkedin
    dict(platform="linkedin", name="MDLI LinkedIn", category="ML/DL/AI", url="machine-deep-learning-israel", active=True, activity=4),
    dict(platform="linkedin", name="DataHack LinkedIn", category="Data Science", url="datahack", active=True, activity=3),
    dict(platform="linkedin", name="Big Data Israel \u2013 LinkedIn Group", category="Data Eng", url="linkedin.com/groups/4293229", active=False, activity=3),
    dict(platform="linkedin", name="Israel Algorithms \u2013 LinkedIn", category="ML/DL/AI", url="linkedin.com/groups/5052809", active=False, activity=2),
    dict(platform="linkedin", name="\u05d4\u05dc\u05e9\u05db\u05d4 \u05dc\u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d5\u05ea \u05de\u05d9\u05d3\u05e2 \u2013 Data & AI", category="CDO/\u05de\u05e0\u05d4\u05dc\u05d9\u05dd", url="israel-it", active=False, activity=3),
    # meetup
    dict(platform="meetup", name="Big Data & Data Science Israel", category="Data Eng", url="big-data-israel", active=True, activity=3),
    dict(platform="meetup", name="DataHack Meetup", category="Data Science", url="DataHack", active=True, activity=3),
    dict(platform="meetup", name="ML & Big Data Hands-On TLV", category="ML/DL/AI", url="Machine_Learning_and_Big_Data_hands_on", active=True, activity=2),
    dict(platform="meetup", name="Tel Aviv AI/ML/Data Developers", category="ML/DL/AI", url="tel-aviv-ai-tech-talks", active=False, activity=3),
    dict(platform="meetup", name="Tel Aviv Deep Learning Bootcamp", category="ML/DL/AI", url="Tel-Aviv-Deep-Learning-Bootcamp", active=False, activity=2),
    dict(platform="meetup", name="Tel Aviv School of AI", category="ML/DL/AI", url="Tel-Aviv-School-of-AI", active=False, activity=3),
    dict(platform="meetup", name="Data Driven AI Tel Aviv", category="Data Science", url="meetup-group-data-driven", active=False, activity=3),
    dict(platform="meetup", name="IBM Big Data Enthusiasts Israel", category="Data Eng", url="topics/big-data-analytics/il", active=False, activity=2),
    dict(platform="meetup", name="Medical Data Science Israel", category="Data Science", url="find/il--tel-aviv-yafo/machine-learning", active=False, activity=2),
    dict(platform="meetup", name="H2O.ai AutoML Israel", category="ML/DL/AI", url="topics/automatic-machine-learning/il", active=False, activity=1),
    # custom / vendor
    dict(platform="custom", name="Snowflake User Group Israel", category="Data Eng", url="https://usergroups.snowflake.com/israel/", active=False, activity=3),
    dict(platform="custom", name="Power BI User Group Israel", category="BI/Analytics", url="https://www.meetup.com/israel-power-bi-user-group/", active=False, activity=3),
    dict(platform="custom", name="Tableau Israel User Group", category="BI/Analytics", url="https://usergroups.tableau.com/israel", active=False, activity=2),
    dict(platform="custom", name="Databricks User Group Israel", category="Data Eng", url="https://www.meetup.com/databricks-israel-user-group/", active=False, activity=2),
    dict(platform="custom", name="AWS User Group Israel", category="Cloud/Infra", url="https://www.meetup.com/AWS-User-Group-Tel-Aviv/", active=False, activity=3),
    dict(platform="custom", name="GDG Tel Aviv \u2013 Google Cloud", category="Cloud/Infra", url="https://gdg.community.dev/gdg-tel-aviv/", active=False, activity=3),
    dict(platform="custom", name="DataHack \u2013 \u05e2\u05de\u05d5\u05ea\u05ea Data Science", category="Data Science", url="https://www.datahack.org.il/", active=False, activity=4),
    dict(platform="custom", name="\u05d4\u05dc\u05e9\u05db\u05d4 \u05dc\u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d5\u05ea \u05de\u05d9\u05d3\u05e2 \u2013 Data & AI", category="CDO/\u05de\u05e0\u05d4\u05dc\u05d9\u05dd", url="https://www.israel-it.org/data-ai", active=False, activity=3),
    dict(platform="custom", name="DatA-IL \u2013 \u05d7\u05d3\u05e9\u05e0\u05d5\u05ea \u05d3\u05d0\u05d8\u05d4 \u05dc\u05e6\u05d9\u05d1\u05d5\u05e8", category="CDO/\u05de\u05e0\u05d4\u05dc\u05d9\u05dd", url="https://data-il.org/", active=False, activity=3),
    dict(platform="custom", name="AI Coffee Club Israel", category="AI \u05d2\u05e0\u05e8\u05d8\u05d9\u05d1\u05d9", url="https://aicoffeeclub.co.il/", active=False, activity=4),
    dict(platform="custom", name="Y-DATA / Nebius Academy Israel", category="Data Science", url="https://www.ydata.co.il/", active=False, activity=4),
    dict(platform="custom", name="\u05d5\u05d5\u05d1 \u05d0\u05e0\u05dc\u05d9\u05d8\u05d9\u05e7\u05e1 \u05d9\u05e9\u05e8\u05d0\u05dc", category="BI/Analytics", url="https://www.analytics.org.il/", active=False, activity=2),
]


def scraper_type(platform):
    if platform == "telegram":
        return "telegram"
    if platform == "linkedin":
        return "linkedin"
    return "manual"


inserted = skipped = 0
for s in sources:
    cur.execute("""
        INSERT INTO public.channels
          (name, username, platform, category, is_active, is_member, activity_score, scraper_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (username) DO NOTHING;
    """, (
        s["name"], s["url"], s["platform"], s["category"],
        s["active"], True, s["activity"], scraper_type(s["platform"]),
    ))
    if cur.rowcount == 1:
        inserted += 1
    else:
        skipped += 1

print(f"Inserted: {inserted}  |  Skipped (conflict): {skipped}")

print("\n=== COUNT BY PLATFORM ===")
cur.execute("SELECT COUNT(*), platform FROM public.channels GROUP BY platform ORDER BY COUNT(*) DESC;")
for r in cur.fetchall():
    print(f"  {r[1]:<12}  {r[0]}")

cur.close()
conn.close()
