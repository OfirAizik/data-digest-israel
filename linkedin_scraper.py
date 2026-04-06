# -*- coding: utf-8 -*-
import json
import os
import sys
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, date

# ── ensure playwright is available ───────────────────────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright",
                           "--break-system-packages"])
    from playwright.sync_api import sync_playwright

from secrets import CLAUDE_API_KEY, SUPABASE_URL, SUPABASE_KEY as SUPABASE_SERVICE_KEY

SESSION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "linkedin_session.json")
BATCH_SIZE   = 10   # groups per Phase-1 batch
POSTS_PER_GROUP = 20


# ── Supabase helpers ──────────────────────────────────────────────────────────

def fetch_active_linkedin_channels():
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/channels"
        f"?platform=eq.linkedin&is_active=eq.true&select=name,url",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Supabase error {e.code}: {e.read().decode()}")
        raise
    channels = [row for row in rows if row.get("url")]
    print(f"Fetched {len(channels)} active LinkedIn channel(s) from Supabase.")
    return channels


def save_to_supabase(report):
    row = {
        "report_date": report["generated_at"][:10],
        "source":      "linkedin",
        "total_posts": report["total_posts_analyzed"],
        "topics":      json.dumps(report, ensure_ascii=False),
    }
    payload = json.dumps(row, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/digest_reports",
        data=payload,
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        print(f"Supabase save error {e.code}: {e.read().decode()}")
        raise


# ── LinkedIn scraping ─────────────────────────────────────────────────────────

def load_session_cookies():
    if not os.path.exists(SESSION_FILE):
        raise FileNotFoundError(
            f"No session file found at {SESSION_FILE}. "
            "Run setup_linkedin.py first to authenticate."
        )
    with open(SESSION_FILE, encoding="utf-8") as f:
        return json.load(f)


def scrape_group(page, group_url, group_name, limit=POSTS_PER_GROUP):
    """Navigate to a LinkedIn group feed and collect post texts."""
    posts = []
    try:
        page.goto(group_url, timeout=30_000)
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(2000)

        # Expand "see more" links so we get full post text
        for btn in page.locator("button.feed-shared-inline-show-more-text").all()[:limit]:
            try:
                btn.click(timeout=1000)
            except Exception:
                pass

        post_els = page.locator(
            ".feed-shared-update-v2__description, "
            ".feed-shared-text, "
            "span[dir='ltr'], span[dir='rtl']"
        ).all()

        seen = set()
        for el in post_els:
            text = (el.inner_text() or "").strip()
            if len(text) > 40 and text not in seen:
                seen.add(text)
                posts.append({
                    "group": group_name,
                    "text":  text[:600],
                })
            if len(posts) >= limit:
                break

    except Exception as e:
        print(f"  Warning: failed to scrape {group_name}: {e}")

    print(f"  {group_name}: {len(posts)} posts collected")
    return posts


def scrape_all_groups(channels):
    """Use a single Playwright browser session to scrape all groups."""
    cookies = load_session_cookies()
    all_posts = []   # list of {group, text}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_cookies(cookies)
        page = context.new_page()

        # Verify session is still valid
        page.goto("https://www.linkedin.com/feed/", timeout=30_000)
        page.wait_for_load_state("domcontentloaded")
        if "/login" in page.url or "/authwall" in page.url:
            browser.close()
            raise RuntimeError(
                "LinkedIn session expired. Re-run setup_linkedin.py to refresh cookies."
            )

        for ch in channels:
            posts = scrape_group(page, ch["url"], ch["name"])
            all_posts.extend(posts)

        browser.close()

    print(f"Total posts collected: {len(all_posts)}")
    return all_posts


# ── Claude API helper ─────────────────────────────────────────────────────────

def call_claude(prompt, max_tokens):
    payload = json.dumps({
        "model":      "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages":   [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key":         CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type":      "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read().decode("utf-8"))

    usage    = result.get("usage", {})
    raw_text = result["content"][0]["text"].strip()

    # Strip markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text[3:]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

    try:
        return json.loads(raw_text), usage
    except json.JSONDecodeError:
        # Try to extract the outermost JSON object or array
        try:
            start = raw_text.index('{')
            end   = raw_text.rindex('}') + 1
            return json.loads(raw_text[start:end]), usage
        except (ValueError, json.JSONDecodeError):
            pass
        try:
            start = raw_text.index('[')
            end   = raw_text.rindex(']') + 1
            return json.loads(raw_text[start:end]), usage
        except (ValueError, json.JSONDecodeError):
            raise ValueError(
                f"Could not parse JSON from Claude response. "
                f"Last 200 chars: {raw_text[-200:]!r}"
            )


# ── Two-phase summarization ───────────────────────────────────────────────────

def phase1_extract_batch(batch_posts, batch_index):
    """
    Phase 1 — extract top-5 topics from one batch of posts (≤10 groups).
    Returns a list of topic dicts.
    """
    lines = [f"[{p['group']}] {p['text']}" for p in batch_posts]
    prompt = (
        "You are an analyst for Israeli professional communities on LinkedIn.\n"
        "Below are posts from a batch of LinkedIn groups.\n\n"
        "Extract the TOP 5 most discussed topics from these posts.\n"
        "For each topic return a JSON object with these fields:\n"
        "  title            (string)  – topic name, concise\n"
        "  frequency_score  (integer) – how frequently discussed, 1-10\n"
        "  category         (string)  – one of: AI/Tech, Business/Strategy, "
        "Career/Jobs, Leadership, Data/Analytics, FinTech, Marketing, Other\n"
        "  summary          (string)  – exactly 2 sentences describing the topic\n"
        "  source_groups    (array)   – list of group names where this topic appeared\n\n"
        "Posts:\n"
        + "\n---\n".join(lines)
        + "\n\nRespond with only a valid JSON array of exactly 5 topic objects. "
        "No text before or after."
    )

    print(f"  Phase 1 batch {batch_index}: calling Claude ({len(batch_posts)} posts)...")
    topics, usage = call_claude(prompt, max_tokens=2000)
    in_tok  = usage.get("input_tokens", 0)
    out_tok = usage.get("output_tokens", 0)
    print(f"    Extracted {len(topics)} topics | tokens: in={in_tok} out={out_tok}")
    return topics, usage


def phase2_global_ranking(all_extracted_topics, total_posts, total_groups):
    """
    Phase 2 — rank and deduplicate ALL extracted topics across batches,
    produce the final structured JSON report.
    """
    topics_json = json.dumps(all_extracted_topics, ensure_ascii=False, indent=2)

    prompt = (
        "You are a senior analyst for Israeli professional LinkedIn communities.\n\n"
        "Below is a list of topics extracted from multiple batches of LinkedIn group posts.\n"
        "Some topics may be duplicates or closely related.\n\n"
        "Your task:\n"
        "1. Merge duplicate/similar topics into single entries.\n"
        "2. Rank all topics by frequency_score and cross-group importance.\n"
        "3. Keep the TOP 5 topics per category.\n"
        "4. Produce a final JSON report in this exact structure:\n\n"
        "{\n"
        '  "platform": "linkedin",\n'
        f'  "generated_at": "{datetime.now(timezone.utc).isoformat()}",\n'
        f'  "total_posts_analyzed": {total_posts},\n'
        f'  "total_groups_scraped": {total_groups},\n'
        '  "categories": [\n'
        "    {\n"
        '      "name": "category name in Hebrew",\n'
        '      "topics": [\n'
        "        {\n"
        '          "title": "topic title",\n'
        '          "summary": "2-3 sentence summary",\n'
        '          "discussion_points": ["point1", "point2"],\n'
        '          "source_groups": ["group1", "group2"],\n'
        '          "engagement_level": "high/medium/low",\n'
        '          "frequency_score": 8\n'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Category names in Hebrew mapping:\n"
        "  AI/Tech → בינה מלאכותית וטכנולוגיה\n"
        "  Business/Strategy → עסקים ואסטרטגיה\n"
        "  Career/Jobs → קריירה ותעסוקה\n"
        "  Leadership → מנהיגות וניהול\n"
        "  Data/Analytics → נתונים ואנליטיקה\n"
        "  FinTech → פינטק\n"
        "  Marketing → שיווק\n"
        "  Other → אחר\n\n"
        "Extracted topics:\n"
        + topics_json
        + "\n\nRespond with only the valid JSON report object. No text before or after."
    )

    print(f"Phase 2: calling Claude for global ranking "
          f"({len(all_extracted_topics)} raw topics)...")
    report, usage = call_claude(prompt, max_tokens=8000)
    in_tok  = usage.get("input_tokens", 0)
    out_tok = usage.get("output_tokens", 0)
    print(f"  Global ranking done | tokens: in={in_tok} out={out_tok}")
    return report, usage


def summarize_with_claude(posts_by_group, groups):
    """
    Two-phase summarization.
    posts_by_group: flat list of {group, text} dicts
    groups: list of group name strings (for metadata)
    Returns (final_report_dict, total_usage_dict)
    """
    # ── Phase 1: batch extraction ────────────────────────────────────────────
    # Group posts by their group name for batching
    group_names = list(dict.fromkeys(p["group"] for p in posts_by_group))
    batches = [group_names[i:i + BATCH_SIZE]
               for i in range(0, len(group_names), BATCH_SIZE)]

    all_extracted = []
    total_usage   = {"input_tokens": 0, "output_tokens": 0}

    for idx, batch_groups in enumerate(batches, 1):
        batch_posts = [p for p in posts_by_group if p["group"] in batch_groups]
        if not batch_posts:
            continue
        topics, usage = phase1_extract_batch(batch_posts, idx)
        all_extracted.extend(topics)
        total_usage["input_tokens"]  += usage.get("input_tokens", 0)
        total_usage["output_tokens"] += usage.get("output_tokens", 0)

    print(f"\nPhase 1 complete: {len(all_extracted)} raw topics from "
          f"{len(batches)} batch(es).")

    # ── Phase 2: global ranking ──────────────────────────────────────────────
    final_report, usage = phase2_global_ranking(
        all_extracted,
        total_posts=len(posts_by_group),
        total_groups=len(group_names),
    )
    total_usage["input_tokens"]  += usage.get("input_tokens", 0)
    total_usage["output_tokens"] += usage.get("output_tokens", 0)

    return final_report, total_usage


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    started_at   = datetime.now(timezone.utc).isoformat()
    start_time   = time.time()
    total_tokens = 0
    cost_usd     = 0.0
    channels     = []

    print("Starting LinkedIn scraper...")

    try:
        channels = fetch_active_linkedin_channels()
        if not channels:
            print("No active LinkedIn channels found in Supabase. Exiting.")
            return

        posts = scrape_all_groups(channels)
        if not posts:
            print("No posts collected. Exiting.")
            return

        report, usage = summarize_with_claude(posts, [ch["name"] for ch in channels])

        input_tokens  = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        total_tokens  = input_tokens + output_tokens
        # claude-sonnet-4-6: $3/MTok input, $15/MTok output
        cost_usd = round((input_tokens * 3 + output_tokens * 15) / 1_000_000, 6)
        print(f"Total tokens: {total_tokens} (in:{input_tokens} out:{output_tokens}), "
              f"cost: ${cost_usd:.6f}")

        print("Saving report to Supabase...")
        status = save_to_supabase(report)
        print(f"Saved (HTTP {status}).")

        # Pretty-print summary
        for cat in report.get("categories", []):
            print(f"\n── {cat['name']} ──")
            for t in cat.get("topics", []):
                print(f"  [{t.get('frequency_score', '?')}] {t.get('title', '')} "
                      f"({t.get('engagement_level', '')})")

        runtime = int(time.time() - start_time)
        print(f"\n⏱️ Total runtime: {runtime // 60}m {runtime % 60}s")
        print("Done.")

    except Exception as e:
        runtime = int(time.time() - start_time)
        print(f"⏱️ Total runtime: {runtime // 60}m {runtime % 60}s")
        print(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()
