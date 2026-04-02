# -*- coding: utf-8 -*-
import asyncio
import json
import os
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from telethon import TelegramClient
from secrets import TELEGRAM_API_ID, TELEGRAM_API_HASH, CLAUDE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY


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


async def scrape_channel(client, channel, limit=50):
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


def summarize_with_claude(messages):
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
        "Identify the 5 most important topics and return a JSON array with exactly 5 objects.\n\n"
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
        + "\n\nRespond with only valid JSON — an array of exactly 5 topic objects. No text before or after."
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


async def main():
    started_at    = datetime.now(timezone.utc).isoformat()
    channels_list = []
    total_tokens  = 0
    cost_usd      = 0.0

    print("Starting Telegram scraper...")

    try:
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
                print(f"Scraping channel: {channel}")
                messages = await scrape_channel(client, channel)
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
        print("Sending messages to Claude for summarization...")

        topics, usage = summarize_with_claude(all_messages)
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
