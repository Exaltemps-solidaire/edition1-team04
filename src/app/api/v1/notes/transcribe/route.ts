import { NextRequest, NextResponse } from "next/server";
import { isSupportedImageType, transcribeImage, LlmError } from "@/lib/anthropic";

const MAX_BASE64_LENGTH = 8_000_000; // ~6 Mo d'image d'origine

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const imageBase64 = (body as { imageBase64?: unknown })?.imageBase64;
  const mimeType = (body as { mimeType?: unknown })?.mimeType;

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return NextResponse.json({ error: 'Le champ "imageBase64" est requis.' }, { status: 400 });
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image trop volumineuse (6 Mo maximum)." }, { status: 400 });
  }

  if (typeof mimeType !== "string" || !isSupportedImageType(mimeType)) {
    return NextResponse.json(
      { error: "Format d'image non supporté (png, jpeg, webp ou gif attendu)." },
      { status: 400 }
    );
  }

  try {
    const result = await transcribeImage(imageBase64, mimeType);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erreur inattendue lors de la transcription." }, { status: 500 });
  }
}
