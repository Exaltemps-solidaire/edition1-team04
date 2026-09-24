import { describe, expect, it, beforeEach, vi } from "vitest";
import { generateReport, challengeReport, transcribeImage, isSupportedImageType, LlmError } from "./anthropic";

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

describe("transcribeImage", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_BASE_URL = "http://fake.internal:9080";
    process.env.ANTHROPIC_API_KEY = "fake-key";
  });

  it("returns the transcribed text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "Texte transcrit." }] }),
    });

    const result = await transcribeImage("base64data", "image/png", fetchMock as unknown as typeof fetch);

    expect(result.text).toBe("Texte transcrit.");
  });

  it("throws LlmError when the upstream call fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      transcribeImage("base64data", "image/png", fetchMock as unknown as typeof fetch)
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
