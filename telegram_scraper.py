# -*- coding: utf-8 -*-
import asyncio
import json
import os
import smtplib
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from secrets import TELEGRAM_API_ID, TELEGRAM_API_HASH, CLAUDE_API_KEY, SUPABASE_URL, SUPABASE_KEY as SUPABASE_SERVICE_KEY


def load_config_from_supabase():
    """Fetch all rows from app_config and return a flat dict. Returns {} on failure."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/app_config?select=key,value",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            rows = json.loads(response.read().decode("utf-8"))
        if not rows:
            print("app_config table is empty, will fall back to config.json.")
            return {}
        return {row["key"]: row["value"] for row in rows}
    except Exception as e:
        print(f"Warning: failed to fetch app_config from Supabase: {e}")
        return {}


def load_config():
    """Load settings: Supabase app_config first, fall back to config.json."""
    supabase_cfg = load_config_from_supabase()

    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            file_cfg = json.load(f)
    except Exception:
        file_cfg = {}

    # Build a unified flat config, preferring Supabase values
    file_email = file_cfg.get("email", {})
    file_recipients = file_email.get("recipients", [])

    def _get(key, file_val, default):
        return supabase_cfg[key] if key in supabase_cfg else (file_val if file_val is not None else default)

    recipients_raw = supabase_cfg.get("recipients", "")
    if recipients_raw:
        recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]
    else:
        recipients = file_recipients

    config = {
        "messages_limit":      int(_get("messages_limit", file_cfg.get("messages_limit"), 100)),
        "topics_per_category": int(_get("topics_per_category", file_cfg.get("topics_per_category"), 5)),
        "gmail_user":          _get("gmail_user", file_email.get("gmail_user", ""), ""),
        "gmail_pass":          _get("gmail_pass", file_email.get("gmail_app_password", ""), ""),
        "recipients":          recipients,
        "_source":             "supabase" if supabase_cfg else "config.json",
    }
    return config


def fetch_active_channels():
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/telegram_channels?is_active=eq.true&select=username",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            rows = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"Supabase error fetching channels {e.code}: {body}")
        raise
    channels = [row["username"] for row in rows]
    print(f"Fetched {len(channels)} active channel(s) from Supabase: {channels}")
    return channels


def format_members_count(count):
    if count >= 1000:
        return f"{count / 1000:.1f}K"
    return str(count)


def update_members_count(username, count_str):
    payload = json.dumps({"members_count": count_str}).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/telegram_channels?username=eq.{username}",
        data=payload,
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as response:
            return response.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"Warning: failed to update members_count for {username} {e.code}: {body}")


async def scrape_channel(client, channel, limit=100):
    messages = []
    cutoff = datetime.now(timezone.utc).replace(tzinfo=timezone.utc)

    async for message in client.iter_messages(channel, limit=limit):
        if not (message.text and len(message.text) > 20):
            continue

        msg_date = message.date
        if msg_date.tzinfo is None:
            msg_date = msg_date.replace(tzinfo=timezone.utc)

        days_old = (cutoff - msg_date).days
        messages.append({
            "message_id":     message.id,
            "channel":        channel,
            "text":           message.text[:500],
            "date":           message.date.isoformat(),
            "views":          message.views or 0,
            "replies_count":  message.replies.replies if message.replies else 0,
            "forwards":       message.forwards or 0,
            "url":            f"https://t.me/{channel}/{message.id}",
            "is_this_week":   days_old <= 7,
        })
    return messages


def summarize_with_claude(messages, topics_per_category=5):
    """Returns (topics_list, usage_dict)."""
    # Take top 60 messages by views to keep prompt size manageable
    top_messages = sorted(messages, key=lambda m: m["views"], reverse=True)[:60]

    lines = []
    for m in top_messages:
        week_tag = "[השבוע]" if m["is_this_week"] else ""
        lines.append(
            f"[{m['channel']} | {m['date']} | views:{m['views']} "
            f"| replies:{m['replies_count']} | fwd:{m['forwards']} {week_tag}]\n"
            f"{m['text']}\n"
            f"URL: {m['url']}"
        )

    prompt = (
        "You are a news analyst for Israeli tech communities. "
        "Below are Telegram messages with engagement metrics. "
        f"Identify the {topics_per_category} most important topics and return a JSON array "
        f"with exactly {topics_per_category} objects.\n\n"
        "Each object must have these fields:\n"
        "  title               (string)   – topic name in Hebrew\n"
        "  summary             (string)   – 1-2 sentence description in Hebrew\n"
        "  posts_count         (integer)  – number of posts on this topic\n"
        "  trend               (string)   – one of: עולה / יורד / יציב\n"
        "  top_post_url        (string)   – URL of the most viewed or replied post on this topic (from the URLs provided above)\n"
        "  weekly_posts_count  (integer)  – how many posts on this topic are from this week\n"
        "  avg_views           (integer)  – average views across posts on this topic\n"
        "  discussion_points   (array)    – 3 to 5 strings, each describing a specific point discussed in the posts\n"
        "  key_reactions       (array)    – 2 to 3 strings, each describing a main community reaction or sentiment\n\n"
        "Messages:\n"
        + "\n---\n".join(lines)
        + f"\n\nRespond with only valid JSON — an array of exactly {topics_per_category} topic objects. No text before or after."
    )

    payload = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 8000,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))

    usage = result.get("usage", {})

    raw_text = result["content"][0]["text"].strip()

    # Strip markdown fences (handles ```json, ```\n, or plain ```)
    if raw_text.startswith("```"):
        raw_text = raw_text[3:]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

    # Safety check: detect truncated response before attempting JSON parse
    if not raw_text.endswith("]"):
        raise ValueError(
            f"Claude response appears truncated (does not end with ']'). "
            f"Last 100 chars: {raw_text[-100:]!r}"
        )

    return json.loads(raw_text), usage


def save_to_supabase(report):
    row = {
        "report_date": report["report_date"],
        "source":      report["source"],
        "total_posts": report["total_posts_analyzed"],
        "topics":      json.dumps(report["topics"], ensure_ascii=False),
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
        with urllib.request.urlopen(req) as response:
            return response.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"Supabase error {e.code}: {body}")
        raise


def save_run_log(log_data):
    """Write a row to run_logs. Failures are printed but never re-raised."""
    payload = json.dumps(log_data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/run_logs",
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
        with urllib.request.urlopen(req) as response:
            print(f"Run log saved (HTTP {response.status}).")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"Warning: failed to save run log {e.code}: {body}")
    except Exception as e:
        print(f"Warning: failed to save run log: {e}")


def build_email_html(report):
    topics = report.get("topics", [])
    TREND_META = {
        "עולה": ("#16a34a", "#dcfce7", "↑ עולה"),
        "יורד": ("#dc2626", "#fee2e2", "↓ יורד"),
        "יציב": ("#6b7280", "#f3f4f6", "→ יציב"),
    }

    topics_html = ""
    for i, t in enumerate(topics, 1):
        text_color, bg_color, label = TREND_META.get(
            t.get("trend", ""), ("#6b7280", "#f3f4f6", t.get("trend", "—"))
        )

        avg_views = t.get("avg_views", 0)
        avg_views_fmt = f"{avg_views:,}" if isinstance(avg_views, int) else str(avg_views)
        weekly = t.get("weekly_posts_count", 0)
        posts  = t.get("posts_count", 0)

        url = t.get("top_post_url") or ""
        url_html = (
            f'<a href="{url}" style="display:inline-block;margin-top:10px;color:#2563eb;'
            f'font-size:13px;font-weight:600;text-decoration:none;">פוסט מוביל ←</a>'
            if url and url != "null" else ""
        )

        points = t.get("discussion_points") or []
        if points:
            bullets = "".join(
                f'<li style="margin-bottom:4px;color:#374151;font-size:13px;line-height:1.6;">{p}</li>'
                for p in points
            )
            points_html = (
                f'<ul style="margin:10px 0 0 0;padding-right:18px;padding-left:0;list-style:disc;">'
                f'{bullets}</ul>'
            )
        else:
            points_html = ""

        border_top = "border-top:2px solid #e5e7eb;" if i > 1 else ""
        topics_html += f"""
      <div style="padding:20px 28px;{border_top}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="font-size:16px;font-weight:700;color:#111827;line-height:1.4;flex:1;">
            <span style="color:#9ca3af;font-size:13px;margin-left:6px;">{i}.</span>{t.get("title", "")}
          </div>
          <span style="background:{bg_color};color:{text_color};border:1px solid {text_color}44;
                       border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap;">
            {label}
          </span>
        </div>
        <p style="margin:8px 0 0 0;color:#4b5563;font-size:14px;line-height:1.7;">{t.get("summary", "")}</p>
        <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;">
          <span style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;
                       padding:4px 10px;font-size:12px;color:#374151;">
            📄 {posts} פוסטים בנושא
          </span>
          <span style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;
                       padding:4px 10px;font-size:12px;color:#374151;">
            📅 {weekly} השבוע
          </span>
          <span style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;
                       padding:4px 10px;font-size:12px;color:#374151;">
            👁 ממוצע {avg_views_fmt} צפיות
          </span>
        </div>
        {url_html}
        {points_html}
      </div>"""

    return f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;text-align:right;">
  <div style="max-width:660px;margin:32px auto;padding:0 16px;">

    <!-- Header -->
    <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:28px 28px 24px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.1em;color:#93c5fd;margin-bottom:8px;">DATA DIGEST IL</div>
      <div style="font-size:26px;font-weight:800;color:#ffffff;margin-bottom:6px;">סיכום קהילות טק ישראל</div>
      <div style="font-size:14px;color:#bfdbfe;">
        {report["report_date"]} &nbsp;·&nbsp; {report["source"]} &nbsp;·&nbsp; {report["total_posts_analyzed"]} הודעות נסרקו
      </div>
    </div>

    <!-- Topics card -->
    <div style="background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
      <div style="padding:16px 28px 12px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">נושאים מובילים</span>
      </div>
      {topics_html}

      <!-- Footer -->
      <div style="padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px;">
        נוצר אוטומטית על ידי Data Digest IL · {datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")} UTC
      </div>
    </div>

  </div>
</body>
</html>"""


def send_email_digest(report, config):
    """Send HTML digest email via Gmail SMTP. Silently skips if not configured."""
    gmail_user = config.get("gmail_user", "").strip()
    gmail_pass = config.get("gmail_pass", "").strip()
    recipients = [r.strip() for r in config.get("recipients", []) if r.strip()]

    if not gmail_user or not gmail_pass or not recipients:
        print("Email not configured, skipping digest email.")
        return

    subject = f"Data Digest IL – סיכום קהילות {report['report_date']}"
    html_body = build_email_html(report)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = gmail_user
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(gmail_user, gmail_pass)
            smtp.sendmail(gmail_user, recipients, msg.as_string())
        print(f"Email digest sent to {len(recipients)} recipient(s).")
    except Exception as e:
        print(f"Warning: failed to send email digest: {e}")


async def main():
    started_at    = datetime.now(timezone.utc).isoformat()
    channels_list = []
    total_tokens  = 0
    cost_usd      = 0.0

    print("Starting Telegram scraper...")

    try:
        config              = load_config()
        messages_limit      = config["messages_limit"]
        topics_per_category = config["topics_per_category"]
        print(f"Config source: {config['_source']}")
        print(f"  messages_limit={messages_limit}")
        print(f"  topics_per_category={topics_per_category}")
        print(f"  gmail_user={config['gmail_user'] or '(not set)'}")
        print(f"  recipients={config['recipients'] or '(not set)'}")

        channels_list = fetch_active_channels()
        if not channels_list:
            print("No active channels found in Supabase. Exiting.")
            save_run_log({
                "started_at":      started_at,
                "status":          "success",
                "user_email":      "telegram-scraper",
                "sources_scanned": 0,
                "total_tokens":    0,
                "cost_usd":        0.0,
            })
            return

        session_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "digest_session")
        client = TelegramClient(session_path, TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await client.start()
        print("Connected to Telegram.")

        all_messages = []
        try:
            for channel in channels_list:
                try:
                    entity = await client.get_entity(channel)
                    count = entity.participants_count
                    if count is None:
                        full = await client(GetFullChannelRequest(entity))
                        count = full.full_chat.participants_count
                    if count is not None:
                        count_str = format_members_count(count)
                        print(f"  {channel}: {count_str} members")
                        update_members_count(channel, count_str)
                    else:
                        print(f"  {channel}: members_count unavailable, skipping")
                except Exception as e:
                    print(f"  Warning: could not fetch members_count for {channel}: {e}")

            for channel in channels_list:
                print(f"Scraping channel: {channel} (limit={messages_limit})")
                messages = await scrape_channel(client, channel, limit=messages_limit)
                print(f"  Collected {len(messages)} messages from {channel}")
                all_messages.extend(messages)
        finally:
            await client.disconnect()

        if not all_messages:
            print("No messages collected. Exiting.")
            save_run_log({
                "started_at":      started_at,
                "status":          "success",
                "user_email":      "telegram-scraper",
                "sources_scanned": len(channels_list),
                "total_tokens":    0,
                "cost_usd":        0.0,
            })
            return

        print(f"Total messages collected: {len(all_messages)}")
        print(f"Sending messages to Claude for summarization (topics_per_category={topics_per_category})...")

        topics, usage = summarize_with_claude(all_messages, topics_per_category)
        print(f"Received {len(topics)} topics from Claude.")

        input_tokens  = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        total_tokens  = input_tokens + output_tokens
        # claude-sonnet-4-6: $3/MTok input, $15/MTok output
        cost_usd = round((input_tokens * 3 + output_tokens * 15) / 1_000_000, 6)
        print(f"Tokens: {total_tokens} (in:{input_tokens} out:{output_tokens}), cost: ${cost_usd:.6f}")

        report = {
            "report_date":          date.today().isoformat(),
            "source":               ", ".join(channels_list),
            "total_posts_analyzed": len(all_messages),
            "topics":               topics,
        }

        print("Saving report to Supabase...")
        status = save_to_supabase(report)
        print(f"Saved to Supabase (HTTP {status}).")

        send_email_digest(report, config)

        save_run_log({
            "started_at":      started_at,
            "status":          "success",
            "user_email":      "telegram-scraper",
            "sources_scanned": len(channels_list),
            "total_tokens":    total_tokens,
            "cost_usd":        cost_usd,
        })
        print("Done.")

    except Exception as e:
        print(f"Fatal error: {e}")
        save_run_log({
            "started_at":      started_at,
            "status":          "error",
            "user_email":      "telegram-scraper",
            "sources_scanned": len(channels_list),
            "total_tokens":    total_tokens,
            "cost_usd":        cost_usd,
            "error_message":   str(e)[:1000],
        })
        raise


asyncio.run(main())
