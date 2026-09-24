import { NextRequest, NextResponse } from "next/server";
import { generateReport, LlmError } from "@/lib/anthropic";

const MIN_NOTES_LENGTH = 20;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const notes = (body as { notes?: unknown })?.notes;

  if (typeof notes !== "string" || notes.trim().length < MIN_NOTES_LENGTH) {
    return NextResponse.json(
      { error: `Le champ "notes" est requis (au moins ${MIN_NOTES_LENGTH} caractères).` },
      { status: 400 }
    );
  }

  try {
    const result = await generateReport(notes);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erreur inattendue lors de la génération." }, { status: 500 });
  }
}
