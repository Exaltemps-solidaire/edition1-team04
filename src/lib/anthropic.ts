const SYSTEM_PROMPT = `Tu assistes un travailleur social (AEMO ou MJIE) de La Sauvegarde du Nord à rédiger la première version d'un rapport destiné à un magistrat, à partir de ses notes de terrain.

Règles strictes :
- N'invente aucun fait, aucune date, aucun nom qui n'apparaît pas dans les notes fournies. Si une information nécessaire manque, écris "[à compléter par le professionnel]" plutôt que de la deviner.
- Structure le rapport en sections claires : Contexte de la mesure, Éléments observés (faits), Analyse de la situation, Préconisations.
- Distingue explicitement les faits observés des ressentis ou interprétations du professionnel.
- Reste sobre et factuel : ce document pourra être lu par la famille concernée et doit résister à une relecture par un chef de service.
- Ce texte est un brouillon de travail, pas un rapport final : il sera relu et validé par le professionnel avant tout envoi.
- Réponds uniquement en français, avec le rapport structuré, sans commentaire méta autour.`;

export interface GenerateReportResult {
  report: string;
}

export class LlmError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "LlmError";
  }
}

export async function generateReport(
  notes: string,
  fetchImpl: typeof fetch = fetch
): Promise<GenerateReportResult> {
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
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voici les notes de terrain :\n\n${notes}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new LlmError(`Le service LLM a répondu une erreur (${response.status}).`, response.status);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = data.content?.find((block) => block.type === "text")?.text;

  if (!text) {
    throw new LlmError("Réponse du LLM vide ou dans un format inattendu.");
  }

  return { report: text };
}
