import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
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

    fireEvent.click(screen.getByRole("button", { name: /télécharger/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
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
});
