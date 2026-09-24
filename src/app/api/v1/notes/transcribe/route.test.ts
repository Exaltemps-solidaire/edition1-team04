import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>("@/lib/anthropic");
  return {
    ...actual,
    transcribeImage: vi.fn(),
  };
});

import { transcribeImage, LlmError } from "@/lib/anthropic";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/notes/transcribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/v1/notes/transcribe", () => {
  beforeEach(() => {
    vi.mocked(transcribeImage).mockReset();
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const response = await POST(makeRequest({ mimeType: "image/png" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when mimeType is unsupported", async () => {
    const response = await POST(makeRequest({ imageBase64: "abc", mimeType: "application/pdf" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when the image is too large", async () => {
    const response = await POST(makeRequest({ imageBase64: "a".repeat(8_000_001), mimeType: "image/png" }));
    expect(response.status).toBe(400);
  });

  it("returns 200 with the transcribed text on success", async () => {
    vi.mocked(transcribeImage).mockResolvedValue({ text: "Texte transcrit." });

    const response = await POST(makeRequest({ imageBase64: "abc", mimeType: "image/png" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toBe("Texte transcrit.");
  });

  it("returns 502 when the LLM call fails", async () => {
    vi.mocked(transcribeImage).mockRejectedValue(new LlmError("upstream down", 500));

    const response = await POST(makeRequest({ imageBase64: "abc", mimeType: "image/png" }));
    expect(response.status).toBe(502);
  });
});
