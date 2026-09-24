"use client";

import { useState } from "react";

interface ChallengeItem {
  passage: string;
  question: string;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const DOCUMENT_TYPES = ["application/pdf"];
const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`spinner${dark ? " spinner-dark" : ""}`} aria-hidden="true" />;
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

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function isPlainTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type !== "") return false;
  return TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [challengeItems, setChallengeItems] = useState<ChallengeItem[] | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const MIN_NOTES_LENGTH = 20;
  const remaining = MIN_NOTES_LENGTH - notes.trim().length;
  const canSubmit = remaining <= 0 && !loading;

  function appendNotes(text: string) {
    setNotes((current) => (current.trim().length > 0 ? `${current}\n\n${text}` : text));
  }

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

  async function handleFile(file: File) {
    setImporting(true);
    setImportError(null);

    try {
      if (isPlainTextFile(file)) {
        const text = await readFileAsText(file);
        appendNotes(text.trim());
        return;
      }

      if (!IMAGE_TYPES.includes(file.type) && !DOCUMENT_TYPES.includes(file.type)) {
        setImportError("Format non supporté. Utilisez une image, un PDF ou un fichier texte.");
        return;
      }

      const fileBase64 = await readFileAsBase64(file);
      const response = await fetch("/api/v1/notes/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type }),
      });

      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error ?? "Une erreur est survenue.");
        return;
      }

      appendNotes(data.text);
    } catch {
      setImportError("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setImporting(false);
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  async function handleCopyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopyFeedback("Rapport copié dans le presse-papiers.");
    } catch {
      setCopyFeedback("Impossible de copier automatiquement : sélectionnez le texte manuellement.");
    }
  }

  function handleDownloadReport() {
    if (!report) return;
    const filename = `rapport-${new Date().toISOString().slice(0, 10)}.txt`;
    downloadTextFile(filename, report);
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
      <p className="intro">
        Collez vos notes de terrain (visites, échanges, observations), ou importez un fichier
        (photo, PDF, texte). Une première version structurée du rapport sera générée à partir de ce
        contenu, à relire et compléter avant toute transmission.
      </p>

      <section className="card">
        <label htmlFor="notes">Notes de terrain</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex : Visite du 12/03 chez la famille D. L'enfant semble..."
        />

        <div
          className={`drop-zone${dragActive ? " drop-zone-active" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <label htmlFor="file-import" className="drop-zone-label">
            Glissez-déposez un fichier ici, ou{" "}
            <span className="drop-zone-browse">choisissez-le</span>
            <input
              id="file-import"
              type="file"
              className="visually-hidden"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.txt,.md,.csv"
              onChange={handleFileInputChange}
              disabled={importing}
            />
            <br />
            <span className="field-hint">photo, PDF ou fichier texte (.txt, .md, .csv)</span>
          </label>
          {importing && (
            <span className="status-text">
              <Spinner dark /> Import en cours...
            </span>
          )}
        </div>
        {importError && <div className="error-banner">{importError}</div>}
      </section>

      <section className="card">
        <button type="button" className="button-primary" onClick={handleGenerate} disabled={!canSubmit}>
          {loading && <Spinner />}
          {loading ? "Génération en cours..." : "Générer une première version"}
        </button>
        {!loading && remaining > 0 && (
          <p className="field-hint" style={{ marginTop: "0.6rem", marginBottom: 0, textAlign: "center" }}>
            Encore {remaining} caractère{remaining > 1 ? "s" : ""} pour activer le bouton
          </p>
        )}
        <p className="disclaimer" style={{ textAlign: "center" }}>
          Ce brouillon est généré automatiquement et n&apos;engage aucune validation : il doit être
          relu, corrigé et validé par le professionnel avant tout usage.
        </p>
        {error && <div className="error-banner">{error}</div>}
      </section>

      {report && (
        <section className="card">
          <div className="report-header">
            <h2>Première version</h2>
            <div className="button-row">
              <button type="button" className="button-secondary button-small" onClick={handleCopyReport}>
                Copier
              </button>
              <button type="button" className="button-secondary button-small" onClick={handleDownloadReport}>
                Télécharger (.txt)
              </button>
            </div>
          </div>
          {copyFeedback && <p className="status-text">{copyFeedback}</p>}
          <div className="report-output">{report}</div>

          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button type="button" onClick={handleChallenge} disabled={challenging}>
              {challenging && <Spinner />}
              {challenging ? "Analyse en cours..." : "Vérifier mes ressentis"}
            </button>
          </div>

          {challengeError && <div className="error-banner">{challengeError}</div>}

          {challengeItems && challengeItems.length === 0 && (
            <p className="disclaimer">Aucun passage n&apos;a été repéré comme non étayé.</p>
          )}

          {challengeItems && challengeItems.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3>Ressentis à étayer</h3>
              <ul className="challenge-list">
                {challengeItems.map((item, index) => (
                  <li key={index}>
                    <em>&laquo;&nbsp;{item.passage}&nbsp;&raquo;</em>
                    <br />
                    {item.question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
