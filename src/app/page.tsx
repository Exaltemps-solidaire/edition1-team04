"use client";

import { useState } from "react";

export default function Home() {
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = notes.trim().length >= 20 && !loading;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReport(null);

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

  return (
    <main>
      <h1>Brouillon de rapport</h1>
      <p>
        Collez vos notes de terrain (visites, échanges, observations). Une première version
        structurée du rapport sera générée à partir de ce texte, à relire et compléter avant
        toute transmission.
      </p>

      <label htmlFor="notes">Notes de terrain</label>
      <textarea
        id="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Ex : Visite du 12/03 chez la famille D. L'enfant semble..."
      />

      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleGenerate} disabled={!canSubmit}>
          {loading ? "Génération en cours..." : "Générer une première version"}
        </button>
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
        </section>
      )}
    </main>
  );
}
