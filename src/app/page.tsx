"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface ChallengeItem {
  passage: string;
  question: string;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const DOCUMENT_TYPES = ["application/pdf"];
const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];
const DRAFT_STORAGE_KEY = "exaltemps-notes-draft";
const GENERATE_TIMEOUT_MS = 45_000;
const IMPORT_TIMEOUT_MS = 60_000;
const CHALLENGE_TIMEOUT_MS = 45_000;
const PLACEHOLDER_TEXT = /\[à compléter par le professionnel[^\]]*\]/gi;

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

function highlightPlaceholders(node: ReactNode, keyPrefix = "n"): ReactNode {
  if (typeof node === "string") {
    const matches = node.match(PLACEHOLDER_TEXT);
    if (!matches) return node;
    const parts = node.split(PLACEHOLDER_TEXT);
    const result: ReactNode[] = [];
    parts.forEach((part, index) => {
      if (part) result.push(part);
      if (matches[index]) {
        result.push(
          <mark key={`${keyPrefix}-${index}`} className="placeholder-todo">
            {matches[index]}
          </mark>
        );
      }
    });
    return result;
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => highlightPlaceholders(child, `${keyPrefix}-${index}`));
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props?.children === undefined) return node;
    return cloneElement(node, undefined, highlightPlaceholders(props.children, keyPrefix));
  }

  return node;
}

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => <p>{highlightPlaceholders(children)}</p>,
  li: ({ children }: { children?: ReactNode }) => <li>{highlightPlaceholders(children)}</li>,
  strong: ({ children }: { children?: ReactNode }) => <strong>{highlightPlaceholders(children)}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em>{highlightPlaceholders(children)}</em>,
};

export default function Home() {
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importCancellable, setImportCancellable] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [challengeItems, setChallengeItems] = useState<ChallengeItem[] | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const generateControllerRef = useRef<AbortController | null>(null);
  const generateCancelReasonRef = useRef<"user" | "timeout" | null>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const importCancelReasonRef = useRef<"user" | "timeout" | null>(null);
  const challengeControllerRef = useRef<AbortController | null>(null);
  const challengeCancelReasonRef = useRef<"user" | "timeout" | null>(null);

  const MIN_NOTES_LENGTH = 20;
  const remaining = MIN_NOTES_LENGTH - notes.trim().length;
  const canSubmit = remaining <= 0 && !loading;

  // Restaure un brouillon local si l'utilisateur a quitté la page sans générer de rapport.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      // localStorage n'existe que côté client : cette restauration ne peut pas se faire
      // au rendu initial (SSR) sans provoquer un mismatch d'hydratation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setNotes(saved);
    } catch {
      // Stockage local indisponible (navigation privée, quota...) : on ignore silencieusement.
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        if (notes.trim().length > 0) {
          window.localStorage.setItem(DRAFT_STORAGE_KEY, notes);
        } else {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        // Stockage local indisponible : la saisie reste fonctionnelle sans sauvegarde.
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [notes]);

  const appendNotes = useCallback((text: string) => {
    setNotes((current) => (current.trim().length > 0 ? `${current}\n\n${text}` : text));
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setImportError(null);

      if (isPlainTextFile(file)) {
        setImporting(true);
        try {
          const text = await readFileAsText(file);
          appendNotes(text.trim());
        } catch {
          setImportError("Impossible de lire ce fichier. Réessayez.");
        } finally {
          setImporting(false);
        }
        return;
      }

      if (!IMAGE_TYPES.includes(file.type) && !DOCUMENT_TYPES.includes(file.type)) {
        setImportError("Format non supporté. Utilisez une image, un PDF ou un fichier texte.");
        return;
      }

      setImporting(true);
      setImportCancellable(true);
      importCancelReasonRef.current = null;
      const controller = new AbortController();
      importControllerRef.current = controller;
      const timeoutId = setTimeout(() => {
        importCancelReasonRef.current = "timeout";
        controller.abort();
      }, IMPORT_TIMEOUT_MS);

      try {
        const fileBase64 = await readFileAsBase64(file);
        const response = await fetch("/api/v1/notes/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fileBase64, mimeType: file.type }),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          setImportError(data.error ?? "Une erreur est survenue.");
          return;
        }

        appendNotes(data.text);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setImportError(
            importCancelReasonRef.current === "timeout"
              ? "L'import a pris trop de temps et a été interrompu. Réessayez."
              : "Import annulé."
          );
        } else {
          setImportError("Impossible de contacter le serveur. Réessayez.");
        }
      } finally {
        clearTimeout(timeoutId);
        importControllerRef.current = null;
        setImportCancellable(false);
        setImporting(false);
      }
    },
    [appendNotes]
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void handleFile(file);
          }
          break;
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  function handleCancelImport() {
    importCancelReasonRef.current = "user";
    importControllerRef.current?.abort();
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReport(null);
    setChallengeItems(null);
    setChallengeError(null);

    generateCancelReasonRef.current = null;
    const controller = new AbortController();
    generateControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      generateCancelReasonRef.current = "timeout";
      controller.abort();
    }, GENERATE_TIMEOUT_MS);

    try {
      const response = await fetch("/api/v1/rapports/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setReport(data.report);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          generateCancelReasonRef.current === "timeout"
            ? "La génération a pris trop de temps et a été interrompue. Réessayez."
            : "Génération annulée."
        );
      } else {
        setError("Impossible de contacter le serveur. Réessayez.");
      }
    } finally {
      clearTimeout(timeoutId);
      generateControllerRef.current = null;
      setLoading(false);
    }
  }

  function handleCancelGenerate() {
    generateCancelReasonRef.current = "user";
    generateControllerRef.current?.abort();
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

    challengeCancelReasonRef.current = null;
    const controller = new AbortController();
    challengeControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      challengeCancelReasonRef.current = "timeout";
      controller.abort();
    }, CHALLENGE_TIMEOUT_MS);

    try {
      const response = await fetch("/api/v1/rapports/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes, report }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        setChallengeError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setChallengeItems(data.items);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setChallengeError(
          challengeCancelReasonRef.current === "timeout"
            ? "L'analyse a pris trop de temps et a été interrompue. Réessayez."
            : "Analyse annulée."
        );
      } else {
        setChallengeError("Impossible de contacter le serveur. Réessayez.");
      }
    } finally {
      clearTimeout(timeoutId);
      challengeControllerRef.current = null;
      setChallenging(false);
    }
  }

  function handleCancelChallenge() {
    challengeCancelReasonRef.current = "user";
    challengeControllerRef.current?.abort();
  }

  return (
    <main>
      <h1>Brouillon de rapport</h1>
      <p className="intro no-print">
        Collez vos notes de terrain (visites, échanges, observations), ou importez un fichier (photo,
        PDF, texte). Une première version structurée du rapport sera générée à partir de ce contenu.
      </p>

      <section className="card no-print">
        <div className="label-row">
          <label htmlFor="notes">Notes de terrain</label>
          <span className={`char-counter${remaining <= 0 ? " char-counter-ok" : ""}`}>
            {`${notes.trim().length} caractère${notes.trim().length === 1 ? "" : "s"}`}
          </span>
        </div>
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
            Glissez-déposez un fichier ici, collez une image (Ctrl+V), ou{" "}
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
            <span className="field-hint">photo, PDF ou fichier texte (.txt, .md, .csv) — 6 Mo max</span>
          </label>
          {importing && (
            <span className="status-text" role="status" aria-live="polite">
              <Spinner dark /> Import en cours...
              {importCancellable && (
                <button type="button" className="button-cancel" onClick={handleCancelImport}>
                  Annuler
                </button>
              )}
            </span>
          )}
        </div>
        {importError && (
          <div className="error-banner" role="alert">
            {importError}
          </div>
        )}
      </section>

      <section className="card no-print">
        <div className="button-row">
          <button
            type="button"
            className="button-primary"
            onClick={handleGenerate}
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading && <Spinner />}
            {loading ? "Génération en cours..." : "Générer une première version"}
          </button>
          {loading && (
            <button type="button" className="button-cancel" onClick={handleCancelGenerate}>
              Annuler
            </button>
          )}
        </div>
        <p className="disclaimer" style={{ textAlign: "center" }}>
          Ce brouillon est généré automatiquement et n&apos;engage aucune validation : il doit être
          relu, corrigé et validé par le professionnel avant tout usage.
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </section>

      {report && (
        <section className="card">
          <div className="report-header">
            <h2>Première version</h2>
            <div className="button-row no-print">
              <button type="button" className="button-secondary button-small" onClick={handleCopyReport}>
                Copier
              </button>
              <button
                type="button"
                className="button-secondary button-small"
                onClick={handleDownloadReport}
              >
                Télécharger (.txt)
              </button>
            </div>
          </div>
          {copyFeedback && (
            <p className="status-text no-print" role="status" aria-live="polite">
              {copyFeedback}
            </p>
          )}
          <div className="report-output">
            <ReactMarkdown components={markdownComponents}>{report}</ReactMarkdown>
          </div>

          <div className="button-row no-print" style={{ marginTop: "1rem" }}>
            <button type="button" onClick={handleChallenge} disabled={challenging} aria-busy={challenging}>
              {challenging && <Spinner />}
              {challenging ? "Analyse en cours..." : "Vérifier mes ressentis"}
            </button>
            {challenging && (
              <button type="button" className="button-cancel" onClick={handleCancelChallenge}>
                Annuler
              </button>
            )}
          </div>

          {challengeError && (
            <div className="error-banner no-print" role="alert">
              {challengeError}
            </div>
          )}

          {challengeItems && challengeItems.length === 0 && (
            <p className="disclaimer no-print">Aucun passage n&apos;a été repéré comme non étayé.</p>
          )}

          {challengeItems && challengeItems.length > 0 && (
            <div className="no-print" style={{ marginTop: "1rem" }}>
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
