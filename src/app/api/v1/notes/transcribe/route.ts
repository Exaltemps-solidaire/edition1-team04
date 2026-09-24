import { NextRequest, NextResponse } from "next/server";
import { isSupportedFileType, transcribeFile, LlmError } from "@/lib/anthropic";

const MAX_BASE64_LENGTH = 8_000_000; // ~6 Mo de fichier d'origine

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const fileBase64 = (body as { fileBase64?: unknown })?.fileBase64;
  const mimeType = (body as { mimeType?: unknown })?.mimeType;

  if (typeof fileBase64 !== "string" || fileBase64.length === 0) {
    return NextResponse.json({ error: 'Le champ "fileBase64" est requis.' }, { status: 400 });
  }

  if (fileBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Fichier trop volumineux (6 Mo maximum)." }, { status: 400 });
  }

  if (typeof mimeType !== "string" || !isSupportedFileType(mimeType)) {
    return NextResponse.json(
      { error: "Format de fichier non supporté (image png/jpeg/webp/gif ou PDF attendu)." },
      { status: 400 }
    );
  }

  try {
    const result = await transcribeFile(fileBase64, mimeType);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erreur inattendue lors de la transcription." }, { status: 500 });
  }
}
