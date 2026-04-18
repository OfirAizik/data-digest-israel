# -*- coding: utf-8 -*-
"""
linkedin_scraper.py
Scrapes active LinkedIn groups from Supabase and returns structured content
in the same format as telegram_scraper.py
"""
import json
import os
import re
import sys
import time
import random
import asyncio
from datetime import datetime

SESSION_FILE = "linkedin_session.json"

# ── Dependencies ───────────────────────────────────────────────
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

try:
    import anthropic
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic", "--break-system-packages"])
    import anthropic

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secrets import SUPABASE_URL, SUPABASE_DB_PASSWORD, CLAUDE_API_KEY

PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]
DSN = (f"host=db.{PROJECT_REF}.supabase.co port=5432 dbname=postgres "
       f"user=postgres password={SUPABASE_DB_PASSWORD} sslmode=require")

MAX_POSTS_PER_GROUP = 30
MIN_WAIT = 2.0   # seconds between groups
MAX_WAIT = 5.0


# ── Supabase helpers ───────────────────────────────────────────

def get_active_linkedin_channels():
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name, username, url, category
        FROM public.channels
        WHERE platform = 'linkedin' AND is_active = true
        ORDER BY name;
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    channels = [
        {"id": str(r[0]), "name": r[1], "username": r[2], "url": r[3], "category": r[4]}
        for r in rows
    ]
    print(f"  Found {len(channels)} active LinkedIn channels in Supabase")
    return channels

def update_last_scraped(channel_id):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute(
        "UPDATE public.channels SET last_scraped_at = NOW() WHERE id = %s",
        (channel_id,)
    )
    conn.commit()
    cur.close()
    conn.close()


# ── Session ────────────────────────────────────────────────────

def load_session(context):
    if not os.path.exists(SESSION_FILE):
        print(f"❌ {SESSION_FILE} not found. Run setup_linkedin.py first.")
        sys.exit(1)
    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        cookies = json.load(f)
    context.add_cookies(cookies)

def check_session_valid(page):
    """Returns True if still logged in."""
    try:
        page.goto("https://www.linkedin.com/feed/", 
                  wait_until="domcontentloaded", timeout=15000)
        time.sleep(2)
        url = page.url
        if "login" in url or "authwall" in url or "signup" in url:
            return False
        return True
    except Exception:
        return False


# ── Scraping ───────────────────────────────────────────────────

def human_wait():
    """Random human-like delay between actions."""
    time.sleep(random.uniform(MIN_WAIT, MAX_WAIT))

def scrape_group(page, channel):
    """Scrape posts from a single LinkedIn group. Returns list of post dicts."""
    url = channel.get("url", "")
    if not url:
        print(f"  ⚠️  No URL for channel: {channel['name']}")
        return []

    # Ensure URL ends with /
    if not url.endswith("/"):
        url += "/"

    print(f"  📖 Scraping: {channel['name']}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        time.sleep(3)

        # Check if we got redirected to login
        if "login" in page.url or "authwall" in page.url:
            print(f"  ❌ Session expired during scraping")
            return None  # Signal session expired

        # Scroll to load posts
        for _ in range(4):
            page.evaluate("window.scrollBy(0, 1000)")
            time.sleep(1.5)

        posts = []

        # Try multiple selectors for post content
        selectors = [
            "[data-urn*='activity'] .feed-shared-update-v2__description",
            ".feed-shared-update-v2__description-wrapper",
            ".update-components-text",
            "[class*='feed-shared'] span[dir='ltr']",
            ".break-words",
        ]

        found_elements = []
        for selector in selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    found_elements = elements
                    break
            except Exception:
                continue

        for el in found_elements[:MAX_POSTS_PER_GROUP]:
            try:
                text = el.inner_text().strip()
                if not text or len(text) < 20:
                    continue

                # Try to get likes/reactions count
                likes = 0
                try:
                    parent = el.locator("..").locator("..").locator("..")
                    likes_el = parent.locator("[class*='social-counts'], [class*='reaction']").first
                    likes_text = likes_el.inner_text().strip()
                    likes_match = re.search(r'[\d,]+', likes_text)
                    if likes_match:
                        likes = int(likes_match.group().replace(",", ""))
                except Exception:
                    pass

                posts.append({
                    "text": text[:500],  # cap at 500 chars per post
                    "likes": likes,
                    "source": channel["name"],
                    "url": url,
                })
            except Exception:
                continue

        # Fallback: get any visible text blocks if no structured posts found
        if not posts:
            try:
                body_text = page.locator("main").inner_text()
                chunks = [c.strip() for c in body_text.split("\n\n") if len(c.strip()) > 50]
                for chunk in chunks[:10]:
                    posts.append({
                        "text": chunk[:500],
                        "likes": 0,
                        "source": channel["name"],
                        "url": url,
                    })
            except Exception:
                pass

        print(f"    → {len(posts)} posts collected")
        return posts

    except Exception as e:
        print(f"  ⚠️  Error scraping {channel['name']}: {e}")
        return []


# ── Claude summarization ───────────────────────────────────────

def summarize_with_claude(all_posts_by_group, config=None):
    """
    Send scraped LinkedIn posts to Claude API for summarization.
    Returns same JSON structure as telegram_scraper.
    """
    if not all_posts_by_group:
        return None

    max_topics = (config or {}).get("topics_per_category", 5)

    # Build prompt
    groups_text = ""
    total_posts = 0
    for group_name, posts in all_posts_by_group.items():
        if not posts:
            continue
        groups_text += f"\n\n### קבוצה: {group_name}\n"
        for i, post in enumerate(posts[:MAX_POSTS_PER_GROUP], 1):
            groups_text += f"{i}. {post['text'][:300]}\n"
            total_posts += 1

    if not groups_text.strip():
        return None

    prompt = f"""אתה מנתח תוכן מקצועי של קהילות Data/AI/BI בישראל ובעולם.
להלן פוסטים מקבוצות LinkedIn בתחומי Data, AI, BI ו-ML.

{groups_text}

צור דוח JSON מובנה בפורמט הבא בדיוק:
{{
  "platform": "linkedin",
  "generated_at": "{datetime.now().isoformat()}",
  "total_posts_analyzed": {total_posts},
  "categories": [
    {{
      "name": "שם הקטגוריה בעברית",
      "topics": [
        {{
          "title": "כותרת הנושא",
          "summary": "סיכום קצר 2-3 משפטים",
          "discussion_points": ["נקודה 1", "נקודה 2"],
          "source_groups": ["שם קבוצה"],
          "engagement_level": "high/medium/low"
        }}
      ]
    }}
  ]
}}

קטגוריות אפשריות: AI/ML, Data Engineering, BI/Analytics, Career/Jobs, Tools/Tech, General
החזר עד {max_topics} נושאים לקטגוריה. החזר JSON בלבד ללא הסברים נוספים."""

    client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    result = json.loads(raw)
    result["input_tokens"]  = response.usage.input_tokens
    result["output_tokens"] = response.usage.output_tokens
    result["total_tokens"]  = response.usage.input_tokens + response.usage.output_tokens
    result["cost_usd"]      = round(
        response.usage.input_tokens * 3/1_000_000 +
        response.usage.output_tokens * 15/1_000_000, 4
    )
    return result


# ── Main ───────────────────────────────────────────────────────

def run_linkedin_scraper(notify_session_expired=None):
    """
    Main entry point.
    Returns dict with keys: report (JSON), tokens, cost, groups_scraped
    Returns None if session expired.
    """
    print("\n🔷 LinkedIn Scraper starting...")

    channels = get_active_linkedin_channels()
    if not channels:
        print("  No active LinkedIn channels. Enable some in the app → ערוצים")
        return {"report": None, "tokens": 0, "cost": 0, "groups_scraped": 0}

    all_posts_by_group = {}
    session_expired = False

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # runs silently in background
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        load_session(context)
        page = context.new_page()

        # Verify session
        print("  Checking session validity...")
        if not check_session_valid(page):
            print("  ❌ Session expired! Run setup_linkedin.py to refresh.")
            browser.close()
            if notify_session_expired:
                notify_session_expired()
            return None

        print("  ✅ Session valid")

        # Scrape each group
        for channel in channels:
            posts = scrape_group(page, channel)
            if posts is None:  # session expired mid-scrape
                session_expired = True
                break
            if posts:
                all_posts_by_group[channel["name"]] = posts
                update_last_scraped(channel["id"])
            human_wait()

        browser.close()

    if session_expired:
        print("  ❌ Session expired during scraping. Run setup_linkedin.py.")
        if notify_session_expired:
            notify_session_expired()
        return None

    if not all_posts_by_group:
        print("  ⚠️  No posts collected from any group")
        return {"report": None, "tokens": 0, "cost": 0, "groups_scraped": 0}

    # Summarize
    print(f"\n  📊 Summarizing {sum(len(p) for p in all_posts_by_group.values())} posts from {len(all_posts_by_group)} groups...")
    report = summarize_with_claude(all_posts_by_group)

    if report:
        print(f"  ✅ LinkedIn summary done | tokens: {report.get('total_tokens',0)} | cost: ${report.get('cost_usd',0)}")

    return {
        "report": report,
        "tokens": report.get("total_tokens", 0) if report else 0,
        "cost": report.get("cost_usd", 0) if report else 0,
        "groups_scraped": len(all_posts_by_group),
    }


# ── Standalone test ────────────────────────────────────────────
if __name__ == "__main__":
    result = run_linkedin_scraper()
    if result and result.get("report"):
        print("\n✅ Report preview:")
        categories = result["report"].get("categories", [])
        for cat in categories:
            print(f"\n  📂 {cat['name']}")
            for topic in cat.get("topics", [])[:2]:
                print(f"    • {topic['title']}")
        print(f"\n  Total tokens: {result['tokens']} | Cost: ${result['cost']}")
    elif result is None:
        print("Session expired.")
    else:
        print("No content scraped.")
