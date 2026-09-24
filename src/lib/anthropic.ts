const REPORT_SYSTEM_PROMPT = `Tu assistes un travailleur social (AEMO ou MJIE) de La Sauvegarde du Nord à rédiger la première version d'un rapport destiné à un magistrat, à partir de ses notes de terrain.

Règles strictes :
- N'invente aucun fait, aucune date, aucun nom qui n'apparaît pas dans les notes fournies. Si une information nécessaire manque, écris "[à compléter par le professionnel]" plutôt que de la deviner.
- Structure le rapport en sections claires : Contexte de la mesure, Éléments observés (faits), Analyse de la situation, Préconisations.
- Distingue explicitement les faits observés des ressentis ou interprétations du professionnel.
- Reste sobre et factuel : ce document pourra être lu par la famille concernée et doit résister à une relecture par un chef de service.
- Ce texte est un brouillon de travail, pas un rapport final : il sera relu et validé par le professionnel avant tout envoi.
- Réponds uniquement en français, avec le rapport structuré, sans commentaire méta autour.`;

const CHALLENGE_SYSTEM_PROMPT = `Tu relis un brouillon de rapport de protection de l'enfance pour aider le travailleur social à étayer ses ressentis et interprétations avant l'envoi au magistrat.

Tâche : repère, dans le rapport, les phrases qui expriment un ressenti, un jugement ou une interprétation du professionnel sans qu'un fait précis des notes de terrain ne soit cité à l'appui.

Réponds UNIQUEMENT avec un tableau JSON (aucun texte autour, aucun bloc markdown), de la forme :
[{"passage": "extrait exact du rapport concerné", "question": "question courte à poser au professionnel pour l'aider à étayer ce passage par un fait ou son expérience professionnelle"}]

Si tout est déjà bien étayé, réponds avec un tableau vide [].
Limite-toi aux 5 passages les plus importants.`;

const TRANSCRIBE_SYSTEM_PROMPT = `Tu transcris fidèlement le texte manuscrit ou dactylographié visible sur un document de notes de terrain fourni par un travailleur social (photo de notes manuscrites ou document PDF).

Règles :
- Retranscris uniquement le texte visible, sans le résumer, le reformuler ou le compléter.
- Corrige uniquement les erreurs évidentes de lecture (OCR), jamais le contenu.
- Conserve la structure en lignes/paragraphes autant que possible.
- Si un mot est illisible, écris "[illisible]" à sa place.
- Réponds uniquement avec le texte transcrit, sans commentaire ni introduction.`;

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

const SUPPORTED_DOCUMENT_TYPES = ["application/pdf"] as const;
export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];

export type SupportedFileType = SupportedImageType | SupportedDocumentType;

export function isSupportedImageType(mimeType: string): mimeType is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

export function isSupportedDocumentType(mimeType: string): mimeType is SupportedDocumentType {
  return (SUPPORTED_DOCUMENT_TYPES as readonly string[]).includes(mimeType);
}

export function isSupportedFileType(mimeType: string): mimeType is SupportedFileType {
  return isSupportedImageType(mimeType) || isSupportedDocumentType(mimeType);
}

export interface GenerateReportResult {
  report: string;
}

export interface ChallengeItem {
  passage: string;
  question: string;
}

export interface TranscribeFileResult {
  text: string;
}

export class LlmError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "LlmError";
  }
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicImageContent {
  type: "image";
  source: { type: "base64"; media_type: SupportedImageType; data: string };
}

interface AnthropicDocumentContent {
  type: "document";
  source: { type: "base64"; media_type: SupportedDocumentType; data: string };
}

interface AnthropicTextContent {
  type: "text";
  text: string;
}

type AnthropicMessageContent = AnthropicImageContent | AnthropicDocumentContent | AnthropicTextContent;

async function callMessages(
  system: string,
  content: string | AnthropicMessageContent[],
  maxTokens: number,
  fetchImpl: typeof fetch
): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new LlmError("Configuration LLM manquante (ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY).");
  }

  const response = await fetchImpl(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    throw new LlmError(`Le service LLM a répondu une erreur (${response.status}).`, response.status);
  }

  const data = (await response.json()) as { content?: AnthropicContentBlock[] };
  const text = data.content?.find((block) => block.type === "text")?.text;

  if (!text) {
    throw new LlmError("Réponse du LLM vide ou dans un format inattendu.");
  }

  return text;
}

export async function generateReport(
  notes: string,
  fetchImpl: typeof fetch = fetch
): Promise<GenerateReportResult> {
  const text = await callMessages(
    REPORT_SYSTEM_PROMPT,
    `Voici les notes de terrain :\n\n${notes}`,
    2000,
    fetchImpl
  );
  return { report: text };
}

export async function challengeReport(
  notes: string,
  report: string,
  fetchImpl: typeof fetch = fetch
): Promise<ChallengeItem[]> {
  const text = await callMessages(
    CHALLENGE_SYSTEM_PROMPT,
    `Notes de terrain :\n\n${notes}\n\n---\n\nBrouillon de rapport :\n\n${report}`,
    2000,
    fetchImpl
  );

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const jsonText = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new LlmError("Réponse du LLM illisible (JSON attendu).");
  }

  if (!Array.isArray(parsed)) {
    throw new LlmError("Réponse du LLM dans un format inattendu (tableau attendu).");
  }

  return parsed.filter(
    (item): item is ChallengeItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ChallengeItem).passage === "string" &&
      typeof (item as ChallengeItem).question === "string"
  );
}

export async function transcribeFile(
  fileBase64: string,
  mediaType: SupportedFileType,
  fetchImpl: typeof fetch = fetch
): Promise<TranscribeFileResult> {
  const fileBlock: AnthropicImageContent | AnthropicDocumentContent = isSupportedImageType(mediaType)
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } }
    : { type: "document", source: { type: "base64", media_type: mediaType, data: fileBase64 } };

  const text = await callMessages(
    TRANSCRIBE_SYSTEM_PROMPT,
    [fileBlock, { type: "text", text: "Transcris le texte visible sur ce document de notes." }],
    2000,
    fetchImpl
  );
  return { text };
}
