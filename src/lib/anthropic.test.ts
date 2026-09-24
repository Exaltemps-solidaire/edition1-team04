import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  generateReport,
  challengeReport,
  transcribeFile,
  isSupportedImageType,
  isSupportedDocumentType,
  isSupportedFileType,
  LlmError,
} from "./anthropic";

describe("generateReport", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_BASE_URL = "http://fake.internal:9080";
    process.env.ANTHROPIC_API_KEY = "fake-key";
  });

  it("returns the text content from a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "Rapport généré." }] }),
    });

    const result = await generateReport("des notes suffisamment longues", fetchMock as unknown as typeof fetch);

    expect(result.report).toBe("Rapport généré.");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://fake.internal:9080/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws LlmError when the upstream call fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      generateReport("des notes suffisamment longues", fetchMock as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(LlmError);
  });

  it("throws LlmError when the response has no text content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [] }),
    });

    await expect(
      generateReport("des notes suffisamment longues", fetchMock as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(LlmError);
  });

  it("throws LlmError when configuration is missing", async () => {
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(generateReport("des notes suffisamment longues")).rejects.toBeInstanceOf(LlmError);
  });
});

describe("challengeReport", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_BASE_URL = "http://fake.internal:9080";
    process.env.ANTHROPIC_API_KEY = "fake-key";
  });

  it("parses a valid JSON array response", async () => {
    const items = [{ passage: "il semblait triste", question: "Sur quel fait s'appuie ce constat ?" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: JSON.stringify(items) }] }),
    });

    const result = await challengeReport("notes", "rapport", fetchMock as unknown as typeof fetch);

    expect(result).toEqual(items);
  });

  it("filters out malformed entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify([{ passage: "ok" }, { foo: "bar" }]) }],
      }),
    });

    const result = await challengeReport("notes", "rapport", fetchMock as unknown as typeof fetch);

    expect(result).toEqual([]);
  });

  it("strips a markdown code fence around the JSON array", async () => {
    const items = [{ passage: "il semblait triste", question: "Sur quel fait s'appuie ce constat ?" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "```json\n" + JSON.stringify(items) + "\n```" }],
      }),
    });

    const result = await challengeReport("notes", "rapport", fetchMock as unknown as typeof fetch);

    expect(result).toEqual(items);
  });

  it("extracts the JSON array even when the model adds commentary around it", async () => {
    const items = [{ passage: "il semblait triste", question: "Sur quel fait s'appuie ce constat ?" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          { type: "text", text: "Voici les passages repérés :\n```json\n" + JSON.stringify(items) + "\n```\nJ'espère que cela aide." },
        ],
      }),
    });

    const result = await challengeReport("notes", "rapport", fetchMock as unknown as typeof fetch);

    expect(result).toEqual(items);
  });

  it("throws LlmError when the response is not valid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "pas du json" }] }),
    });

    await expect(
      challengeReport("notes", "rapport", fetchMock as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe("transcribeFile", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_BASE_URL = "http://fake.internal:9080";
    process.env.ANTHROPIC_API_KEY = "fake-key";
  });

  it("returns the transcribed text for an image", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "Texte transcrit." }] }),
    });

    const result = await transcribeFile("base64data", "image/png", fetchMock as unknown as typeof fetch);

    expect(result.text).toBe("Texte transcrit.");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content[0].type).toBe("image");
  });

  it("sends a document content block for a PDF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "Texte transcrit du PDF." }] }),
    });

    const result = await transcribeFile(
      "base64data",
      "application/pdf",
      fetchMock as unknown as typeof fetch
    );

    expect(result.text).toBe("Texte transcrit du PDF.");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content[0].type).toBe("document");
    expect(body.messages[0].content[0].source.media_type).toBe("application/pdf");
  });

  it("throws LlmError when the upstream call fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      transcribeFile("base64data", "image/png", fetchMock as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe("isSupportedImageType", () => {
  it("accepts known image types", () => {
    expect(isSupportedImageType("image/png")).toBe(true);
    expect(isSupportedImageType("image/jpeg")).toBe(true);
  });

  it("rejects unknown types", () => {
    expect(isSupportedImageType("application/pdf")).toBe(false);
  });
});

describe("isSupportedDocumentType", () => {
  it("accepts PDF", () => {
    expect(isSupportedDocumentType("application/pdf")).toBe(true);
  });

  it("rejects unknown types", () => {
    expect(isSupportedDocumentType("image/png")).toBe(false);
  });
});

describe("isSupportedFileType", () => {
  it("accepts images and PDFs", () => {
    expect(isSupportedFileType("image/png")).toBe(true);
    expect(isSupportedFileType("application/pdf")).toBe(true);
  });

  it("rejects unrelated types", () => {
    expect(isSupportedFileType("text/plain")).toBe(false);
  });
});
