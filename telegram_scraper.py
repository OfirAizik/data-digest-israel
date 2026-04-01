# -*- coding: utf-8 -*-
import asyncio
import json
import os
import urllib.error
import urllib.request
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
    async for message in client.iter_messages(channel, limit=limit):
        if message.text and len(message.text) > 20:
            messages.append({
                "channel": channel,
                "text": message.text[:500],
                "date": message.date.isoformat(),
                "views": message.views,
            })
    return messages


def summarize_with_claude(messages):
    prompt = (
        "You are a news analyst. Below are messages scraped from Telegram channels. "
        "Identify the 5 most important topics and return a JSON array with exactly 5 objects. "
        "Each object must have these fields: title (string), summary (string), posts_count (integer), trend (string).\n\n"
        "Messages:\n"
        + "\n---\n".join(f"[{m['channel']} | {m['date']}] {m['text']}" for m in messages)
        + "\n\nRespond with only valid JSON — an array of 5 topic objects."
    )

    payload = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
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
        "source": report["source"],
        "total_posts": report["total_posts_analyzed"],
        "topics": json.dumps(report["topics"], ensure_ascii=False),
    }
    payload = json.dumps(row, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/digest_reports",
        data=payload,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
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

    from datetime import date
    report = {
        "report_date": date.today().isoformat(),
        "source": ", ".join(channels),
        "total_posts_analyzed": len(all_messages),
        "topics": topics,
    }

    print("Saving report to Supabase...")
    status = save_to_supabase(report)
    print(f"Saved to Supabase (HTTP {status}).")

    print("Done.")


asyncio.run(main())
