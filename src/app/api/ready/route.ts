import { NextResponse } from "next/server";

export function GET() {
  const ready = Boolean(process.env.ANTHROPIC_BASE_URL && process.env.ANTHROPIC_API_KEY);
  return NextResponse.json({ status: ready ? "ready" : "not-ready" }, { status: ready ? 200 : 503 });
}
