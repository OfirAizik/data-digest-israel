import { NextResponse } from "next/server";

export async function POST(request) {
  const { apiKey, messages, model, max_tokens } = await request.json();

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
