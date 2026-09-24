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

  it("copies the notes to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /copier les notes/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Des notes suffisamment longues pour activer le bouton.")
    );
    expect(screen.getByText(/copiées dans le presse-papiers/i)).toBeInTheDocument();
  });

  it("triggers a download of the notes as a text file", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<Home />);
    fireEvent.change(screen.getByLabelText(/notes de terrain/i), {
      target: { value: "Des notes suffisamment longues pour activer le bouton." },
    });
    fireEvent.click(screen.getByRole("button", { name: /télécharger les notes/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    clickSpy.mockRestore();
  });

  it("disables copy and download buttons when there are no notes", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: /copier les notes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /télécharger les notes/i })).toBeDisabled();
  });
});
