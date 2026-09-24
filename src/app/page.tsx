"use client";

import { useState } from "react";

interface ChallengeItem {
  passage: string;
  question: string;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [challengeItems, setChallengeItems] = useState<ChallengeItem[] | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const MIN_NOTES_LENGTH = 20;
  const remaining = MIN_NOTES_LENGTH - notes.trim().length;
  const canSubmit = remaining <= 0 && !loading;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReport(null);
    setChallengeItems(null);
    setChallengeError(null);

    try {
      const response = await fetch("/api/v1/rapports/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setReport(data.report);
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setTranscribing(true);
    setTranscribeError(null);

    try {
      const imageBase64 = await readFileAsBase64(file);
      const response = await fetch("/api/v1/notes/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTranscribeError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setNotes((current) => (current.trim().length > 0 ? `${current}\n\n${data.text}` : data.text));
    } catch {
      setTranscribeError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleCopyNotes() {
    try {
      await navigator.clipboard.writeText(notes);
      setCopyFeedback("Notes copiées dans le presse-papiers.");
    } catch {
      setCopyFeedback("Impossible de copier automatiquement : sélectionnez le texte manuellement.");
    }
  }

  function handleDownloadNotes() {
    const filename = `notes-${new Date().toISOString().slice(0, 10)}.txt`;
    downloadTextFile(filename, notes);
  }

  async function handleChallenge() {
    if (!report) return;

    setChallenging(true);
    setChallengeError(null);
    setChallengeItems(null);

    try {
      const response = await fetch("/api/v1/rapports/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes, report }),
      });

      const data = await response.json();

      if (!response.ok) {
        setChallengeError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setChallengeItems(data.items);
    } catch {
      setChallengeError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setChallenging(false);
    }
  }

  return (
    <main>
      <h1>Brouillon de rapport</h1>
      <p>
        Collez vos notes de terrain (visites, échanges, observations), ou importez une photo de
        notes manuscrites. Une première version structurée du rapport sera générée à partir de ce
        texte, à relire et compléter avant toute transmission.
      </p>

      <label htmlFor="photo">Importer une photo de notes (optionnel)</label>
      <div>
        <input
          id="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handlePhotoChange}
          disabled={transcribing}
        />
        {transcribing && <span style={{ marginLeft: "0.75rem" }}>Transcription en cours...</span>}
      </div>
      {transcribeError && <div className="error-banner">{transcribeError}</div>}

      <label htmlFor="notes" style={{ marginTop: "1rem", display: "block" }}>
        Notes de terrain
      </label>
      <textarea
        id="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Ex : Visite du 12/03 chez la famille D. L'enfant semble..."
      />

      <div style={{ marginTop: "0.5rem" }}>
        <button onClick={handleCopyNotes} disabled={notes.trim().length === 0}>
          Copier les notes
        </button>
        <button
          onClick={handleDownloadNotes}
          disabled={notes.trim().length === 0}
          style={{ marginLeft: "0.5rem" }}
        >
          Télécharger les notes (.txt)
        </button>
        {copyFeedback && (
          <span style={{ marginLeft: "0.75rem", color: "#5b6270", fontSize: "0.9rem" }}>
            {copyFeedback}
          </span>
        )}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleGenerate} disabled={!canSubmit}>
          {loading ? "Génération en cours..." : "Générer une première version"}
        </button>
        {!loading && remaining > 0 && (
          <span style={{ marginLeft: "0.75rem", color: "#5b6270", fontSize: "0.9rem" }}>
            Encore {remaining} caractère{remaining > 1 ? "s" : ""} pour activer le bouton
          </span>
        )}
      </div>

      <p className="disclaimer">
        Ce brouillon est généré automatiquement et n&apos;engage aucune validation : il doit être
        relu, corrigé et validé par le professionnel avant tout usage.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {report && (
        <section>
          <h2>Première version</h2>
          <div className="report-output">{report}</div>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={handleChallenge} disabled={challenging}>
              {challenging ? "Analyse en cours..." : "Vérifier mes ressentis"}
            </button>
          </div>

          {challengeError && <div className="error-banner">{challengeError}</div>}

          {challengeItems && challengeItems.length === 0 && (
            <p className="disclaimer">Aucun passage n&apos;a été repéré comme non étayé.</p>
          )}

          {challengeItems && challengeItems.length > 0 && (
            <section style={{ marginTop: "1rem" }}>
              <h3>Ressentis à étayer</h3>
              <ul>
                {challengeItems.map((item, index) => (
                  <li key={index} style={{ marginBottom: "0.75rem" }}>
                    <em>&laquo;&nbsp;{item.passage}&nbsp;&raquo;</em>
                    <br />
                    {item.question}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}
    </main>
  );
}
