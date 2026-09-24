import { NextRequest, NextResponse } from "next/server";
import { challengeReport, LlmError } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const notes = (body as { notes?: unknown })?.notes;
  const report = (body as { report?: unknown })?.report;

  if (typeof notes !== "string" || notes.trim().length === 0) {
    return NextResponse.json({ error: 'Le champ "notes" est requis.' }, { status: 400 });
  }

  if (typeof report !== "string" || report.trim().length === 0) {
    return NextResponse.json({ error: 'Le champ "report" est requis.' }, { status: 400 });
  }

  try {
    const items = await challengeReport(notes, report);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erreur inattendue lors de l'analyse." }, { status: 500 });
  }
}
