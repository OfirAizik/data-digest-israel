# -*- coding: utf-8 -*-
"""
linkedin_group_discovery.py
Discovers all LinkedIn groups you're a member of and adds them to Supabase.
Run AFTER setup_linkedin.py
"""
import json
import os
import sys
import time

SESSION_FILE = "linkedin_session.json"

# ── Install dependencies if missing ───────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "--break-system-packages"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright

try:
    import psycopg2
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "--break-system-packages"])
    import psycopg2

# ── Load secrets ───────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD

PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]
DSN = (
    f"host=db.{PROJECT_REF}.supabase.co port=5432 dbname=postgres "
    f"user=postgres password={SUPABASE_DB_PASSWORD} sslmode=require"
)

def load_session(context):
    if not os.path.exists(SESSION_FILE):
        print(f"❌ {SESSION_FILE} not found. Run setup_linkedin.py first.")
        sys.exit(1)
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        cookies = json.load(f)
    context.add_cookies(cookies)
    print(f"✅ Session loaded from {SESSION_FILE}")

def scrape_groups(page):
    """Scrape all groups from linkedin.com/groups/"""
    print("\n🔍 Navigating to LinkedIn Groups...")
    page.goto("https://www.linkedin.com/groups/", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)

    # Check if still logged in
    if "login" in page.url or "authwall" in page.url:
        print("❌ Session expired. Run setup_linkedin.py again.")
        sys.exit(1)

    groups = {}

    # Scroll to load all groups
    for _ in range(5):
        page.evaluate("window.scrollBy(0, 800)")
        time.sleep(1.5)

    # Find all group links
    links = page.locator("a[href*='/groups/']").all()
    for link in links:
        try:
            href = link.get_attribute("href") or ""
            # Real group URLs have numeric IDs like /groups/1234567/
            import re
            match = re.search(r'/groups/(\d+)', href)
            if not match:
                continue
            group_id = match.group(1)
            if group_id in groups:
                continue

            # Try to get the group name
            name = ""
            try:
                name = link.inner_text().strip()
            except Exception:
                pass

            # Clean up name - remove empty or nav items
            if not name or len(name) < 2 or name.lower() in ["groups", "my groups", "discover"]:
                # Try parent element for name
                try:
                    parent_text = link.locator("..").inner_text().strip()
                    if parent_text and len(parent_text) > 2:
                        name = parent_text.split("\n")[0].strip()
                except Exception:
                    pass

            if not name:
                name = f"LinkedIn Group {group_id}"

            full_url = f"https://www.linkedin.com/groups/{group_id}/"
            groups[group_id] = {
                "name": name[:100],
                "group_id": group_id,
                "url": full_url,
                "platform": "linkedin",
                "scraper_type": "linkedin",
                "is_member": True,
                "is_active": False,  # user activates manually
            }
        except Exception:
            continue

    # Also try the "My Groups" section specifically
    try:
        page.goto("https://www.linkedin.com/groups/?source=myGroups", 
                  wait_until="domcontentloaded", timeout=15000)
        time.sleep(3)
        for _ in range(3):
            page.evaluate("window.scrollBy(0, 800)")
            time.sleep(1)
        links2 = page.locator("a[href*='/groups/']").all()
        for link in links2:
            try:
                href = link.get_attribute("href") or ""
                match = re.search(r'/groups/(\d+)', href)
                if not match:
                    continue
                group_id = match.group(1)
                if group_id in groups:
                    continue
                name = link.inner_text().strip()
                if not name or len(name) < 2:
                    continue
                groups[group_id] = {
                    "name": name[:100],
                    "group_id": group_id,
                    "url": f"https://www.linkedin.com/groups/{group_id}/",
                    "platform": "linkedin",
                    "scraper_type": "linkedin",
                    "is_member": True,
                    "is_active": False,
                }
            except Exception:
                continue
    except Exception as e:
        print(f"Note: Could not load myGroups page: {e}")

    return list(groups.values())

def save_to_supabase(groups):
    """Insert discovered groups into Supabase channels table."""
    if not groups:
        print("No groups to save.")
        return

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    inserted = 0
    skipped = 0
    for g in groups:
        try:
            cur.execute("""
                INSERT INTO public.channels 
                    (name, username, platform, url, is_active, is_member, scraper_type, category)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO NOTHING
            """, (
                g["name"],
                g["group_id"],
                "linkedin",
                g["url"],
                False,
                True,
                "linkedin",
                "Data",  # default category, can be changed in UI
            ))
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  Warning: Could not insert {g['name']}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    print(f"\n✅ Supabase updated: {inserted} new groups inserted, {skipped} already existed.")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--start-maximized"]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        load_session(context)
        page = context.new_page()

        groups = scrape_groups(page)
        browser.close()

    if not groups:
        print("\n⚠️  No groups found. This could mean:")
        print("  1. Your session expired - run setup_linkedin.py again")
        print("  2. LinkedIn changed their HTML structure")
        print("  3. You haven't joined any groups yet")
        return

    print(f"\n📋 Found {len(groups)} LinkedIn groups:")
    print("-" * 60)
    for i, g in enumerate(groups, 1):
        print(f"  {i:2}. {g['name'][:50]:<50} | {g['url']}")
    print("-" * 60)

    answer = input(f"\nAdd all {len(groups)} groups to Supabase? (y/n): ").strip().lower()
    if answer == "y":
        save_to_supabase(groups)
        print("\n✅ Done! Go to the app → ערוצים → activate the groups you want to scan.")
    else:
        print("Cancelled. No changes made.")

if __name__ == "__main__":
    main()
