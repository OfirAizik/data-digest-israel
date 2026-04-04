import { NextResponse } from "next/server";

// In-memory rate limiter: 10 requests per IP per 60-second window.
// Each entry: { count: number, windowStart: number (ms) }
const rateLimitMap = new Map();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= LIMIT) return true;
  entry.count += 1;
  return false;
}

export async function POST(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: { message: "Too many requests" } }, { status: 429 });
  }

  const { messages, model, max_tokens } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: { message: "ANTHROPIC_API_KEY not configured" } }, { status: 500 });
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens, messages }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(data, { status: resp.status });
  }

  return NextResponse.json(data);
}
