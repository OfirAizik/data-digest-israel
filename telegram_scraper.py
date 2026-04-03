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
from secrets import TELEGRAM_API_ID, TELEGRAM_API_HASH, CLAUDE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY


def load_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


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
    lines = []
    for m in messages:
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
        "max_tokens": 3000,
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
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    return json.loads(raw_text.strip()), usage


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
        "עולה": ("#10b981", "↑ עולה"),
        "יורד": ("#ef4444", "↓ יורד"),
        "יציב": ("#4b5563", "→ יציב"),
    }

    rows_html = ""
    for i, t in enumerate(topics, 1):
        color, label = TREND_META.get(t.get("trend", ""), ("#4b5563", t.get("trend", "—")))
        url = t.get("top_post_url") or ""
        url_html = (
            f'<br><a href="{url}" style="color:#3b82f6;font-size:12px;text-decoration:none;">פתח פוסט מוביל ↗</a>'
            if url and url != "null" else ""
        )
        avg_views = t.get("avg_views", 0)
        avg_views_fmt = f"{avg_views:,}" if isinstance(avg_views, int) else str(avg_views)
        rows_html += f"""
        <tr>
          <td style="padding:4px 16px 4px 8px;color:#4b5563;font-size:13px;vertical-align:top;white-space:nowrap;">{i}.</td>
          <td style="padding:12px 16px 12px 0;border-bottom:1px solid #1e2d45;vertical-align:top;">
            <div style="color:#e2e8f0;font-weight:700;font-size:14px;margin-bottom:4px;">{t.get("title","")}</div>
            <div style="color:#94a3b8;font-size:12px;line-height:1.6;">{t.get("summary","")}</div>
            {url_html}
          </td>
          <td style="padding:12px 16px 12px 0;border-bottom:1px solid #1e2d45;vertical-align:top;white-space:nowrap;">
            <span style="background:{color}22;color:{color};border:1px solid {color}44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">{label}</span>
          </td>
          <td style="padding:12px 16px 12px 0;border-bottom:1px solid #1e2d45;vertical-align:top;color:#94a3b8;font-size:12px;white-space:nowrap;">
            {t.get("posts_count",0)} פוסטים<br>{avg_views_fmt} צפיות
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e2d45;">

      <!-- Header -->
      <div style="background:#1a2236;padding:24px 28px;border-bottom:1px solid #1e2d45;">
        <div style="color:#3b82f6;font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:6px;">📊 DATA DIGEST ISRAEL</div>
        <div style="color:#e2e8f0;font-size:22px;font-weight:800;margin-bottom:6px;">{report["report_date"]}</div>
        <div style="color:#94a3b8;font-size:13px;">
          {report["source"]} &nbsp;·&nbsp; {report["total_posts_analyzed"]} הודעות נסרקו
        </div>
      </div>

      <!-- Topics -->
      <div style="padding:16px 28px 0;">
        <div style="color:#4b5563;font-size:10px;font-weight:700;letter-spacing:0.08em;margin-bottom:12px;">נושאים מובילים</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          {rows_html}
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:20px 28px;color:#374151;font-size:11px;text-align:center;">
        נוצר אוטומטית על ידי Data Digest Israel · {datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")} UTC
      </div>
    </div>
  </div>
</body>
</html>"""


def send_email_digest(report, config):
    """Send HTML digest email via Gmail SMTP. Silently skips if not configured."""
    email_cfg = config.get("email", {})
    gmail_user = email_cfg.get("gmail_user", "").strip()
    gmail_pass = email_cfg.get("gmail_app_password", "").strip()
    recipients = [r.strip() for r in email_cfg.get("recipients", []) if r.strip()]

    if not gmail_user or not gmail_pass or not recipients:
        print("Email not configured, skipping digest email.")
        return

    subject = f"Data Digest Israel – {report['report_date']}"
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
        messages_limit      = config.get("messages_limit", 100)
        topics_per_category = config.get("topics_per_category", 5)
        print(f"Config: messages_limit={messages_limit}, topics_per_category={topics_per_category}")

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
