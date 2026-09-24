import { describe, expect, it, beforeEach, vi } from "vitest";
import { generateReport, LlmError } from "./anthropic";

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
