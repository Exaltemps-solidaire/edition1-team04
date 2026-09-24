import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("disables the button until enough notes are entered", () => {
    render(<Home />);
    const button = screen.getByRole("button", { name: /générer/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });

    expect(button).toBeEnabled();
  });

  it("displays the generated report on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ report: "Voici le rapport généré." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() => expect(screen.getByText("Voici le rapport généré.")).toBeInTheDocument());
  });

  it("displays an error banner when the API call fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Erreur serveur." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() => expect(screen.getByText("Erreur serveur.")).toBeInTheDocument());
  });

  it("does not show copy/download buttons before a report exists", () => {
    render(<Home />);
    expect(screen.queryByRole("button", { name: /^copier$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /télécharger/i })).not.toBeInTheDocument();
  });

  it("copies the report to the clipboard once generated", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ report: "Voici le rapport généré." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));
    await waitFor(() => expect(screen.getByText("Voici le rapport généré.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^copier$/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Voici le rapport généré."));
    expect(screen.getByText(/copié dans le presse-papiers/i)).toBeInTheDocument();
  });

  it("triggers a download of the report as a text file once generated", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ report: "Voici le rapport généré." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));
    await waitFor(() => expect(screen.getByText("Voici le rapport généré.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /télécharger \(\.txt\)/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
  });

  it("triggers a download of the report as a Word-compatible file once generated", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ report: "## Titre\n\nVoici le rapport généré." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Titre" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /\.doc/i }));

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain("application/msword");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
  });

  it("opens the print dialog to export the report as PDF", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ report: "Voici le rapport généré." }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));
    await waitFor(() => expect(screen.getByText("Voici le rapport généré.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /imprimer/i }));

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("imports a dropped text file into the notes without calling the API", async () => {
    render(<Home />);
    const dropZone = screen.getByLabelText(/glissez-déposez/i).closest(".drop-zone") as HTMLElement;
    const file = new File(["Notes importées depuis un fichier texte."], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByLabelText(/notes de terrain/i)).toHaveValue(
        "Notes importées depuis un fichier texte."
      )
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders markdown formatting in the generated report", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        report: "## Titre\n\n**Important** et une liste :\n- item un\n- item deux",
      }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Titre" })).toBeInTheDocument()
    );
    expect(screen.getByText("Important").tagName).toBe("STRONG");
    expect(screen.getByText("item un")).toBeInTheDocument();
  });

  it("highlights placeholder markers in the generated report", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        report: "Contexte familial : [à compléter par le professionnel].",
      }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() => {
      const mark = document.querySelector("mark.placeholder-todo");
      expect(mark).not.toBeNull();
      expect(mark?.textContent).toBe("[à compléter par le professionnel]");
    });
  });

  it("shows a small character counter above the textarea instead of the old sentence hint", () => {
    render(<Home />);
    expect(screen.getByText("0 caractères")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/notes de terrain/i), { target: { value: "12345" } });

    expect(screen.getByText("5 caractères")).toBeInTheDocument();
    expect(screen.queryByText(/pour activer le bouton/i)).not.toBeInTheDocument();
  });

  it("surfaces the file size limit upfront in the import hint", () => {
    render(<Home />);
    expect(screen.getByText(/6 Mo max/i)).toBeInTheDocument();
  });

  it("marks the generate button as busy while a report is being generated", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }) as unknown as Promise<Response>
    );

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    const button = screen.getByRole("button", { name: /générer/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");

    resolveFetch({ ok: true, json: async () => ({ report: "Rapport." }) });
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
  });

  it("lets the user cancel an in-flight report generation", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          (options as { signal: AbortSignal }).signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }) as unknown as Promise<Response>
    );

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    const cancelButton = await screen.findByRole("button", { name: /annuler/i });
    fireEvent.click(cancelButton);

    await waitFor(() => expect(screen.getByText("Génération annulée.")).toBeInTheDocument());
  });

  it("imports an image pasted from the clipboard", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Texte transcrit depuis une image collée." }),
    } as Response);

    render(<Home />);

    const file = new File(["binary-content"], "capture.png", { type: "image/png" });
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { items: [{ kind: "file", type: "image/png", getAsFile: () => file }] },
    });
    window.dispatchEvent(pasteEvent);

    await waitFor(() =>
      expect(screen.getByLabelText(/notes de terrain/i)).toHaveValue(
        "Texte transcrit depuis une image collée."
      )
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/notes/transcribe",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("autosaves notes to localStorage and restores them on the next mount", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<Home />);

    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Brouillon à sauvegarder localement." },
    });

    await vi.advanceTimersByTimeAsync(600);
    expect(window.localStorage.getItem("exaltemps-notes-draft")).toBe(
      "Brouillon à sauvegarder localement."
    );

    unmount();
    vi.useRealTimers();

    render(<Home />);
    expect(screen.getByLabelText(/notes de terrain/i)).toHaveValue(
      "Brouillon à sauvegarder localement."
    );
  });
});
