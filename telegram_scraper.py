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
        # Ensure offset-aware for comparison
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
        "  title          (string)  – topic name\n"
        "  summary        (string)  – 2-3 sentence description\n"
        "  posts_count    (integer) – number of posts on this topic\n"
        "  trend          (string)  – one of: עולה / יורד / יציב\n"
        "  top_post_url   (string)  – URL of the most viewed or replied post on this topic\n"
        "  weekly_posts_count (integer) – how many posts on this topic are from this week\n"
        "  avg_views      (integer) – average views across posts on this topic\n\n"
        "Messages:\n"
        + "\n---\n".join(lines)
        + "\n\nRespond with only valid JSON — an array of 5 topic objects."
    )

    payload = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 1500,
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

    raw_text = result["content"][0]["text"].strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    return json.loads(raw_text.strip())


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


async def main():
    print("Starting Telegram scraper...")

    channels = fetch_active_channels()
    if not channels:
        print("No active channels found in Supabase. Exiting.")
        return

    session_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "digest_session")
    client = TelegramClient(session_path, TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await client.start()
    print("Connected to Telegram.")

    all_messages = []
    for channel in channels:
        print(f"Scraping channel: {channel}")
        messages = await scrape_channel(client, channel)
        print(f"  Collected {len(messages)} messages from {channel}")
        all_messages.extend(messages)

    await client.disconnect()

    if not all_messages:
        print("No messages collected. Exiting.")
        return

    print(f"Total messages collected: {len(all_messages)}")
    print("Sending messages to Claude for summarization...")

    topics = summarize_with_claude(all_messages)
    print(f"Received {len(topics)} topics from Claude.")

    report = {
        "report_date":         date.today().isoformat(),
        "source":              ", ".join(channels),
        "total_posts_analyzed": len(all_messages),
        "topics":              topics,
    }

    print("Saving report to Supabase...")
    status = save_to_supabase(report)
    print(f"Saved to Supabase (HTTP {status}).")

    print("Done.")


asyncio.run(main())
