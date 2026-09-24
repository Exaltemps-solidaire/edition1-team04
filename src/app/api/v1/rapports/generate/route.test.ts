import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>("@/lib/anthropic");
  return {
    ...actual,
    generateReport: vi.fn(),
  };
});

import { generateReport, LlmError } from "@/lib/anthropic";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/rapports/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/v1/rapports/generate", () => {
  beforeEach(() => {
    vi.mocked(generateReport).mockReset();
  });

  it("returns 400 when notes are missing", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 400 when notes are too short", async () => {
    const response = await POST(makeRequest({ notes: "trop court" }));
    expect(response.status).toBe(400);
  });

  it("returns 200 with the generated report on success", async () => {
    vi.mocked(generateReport).mockResolvedValue({ report: "Contenu du rapport." });

    const response = await POST(makeRequest({ notes: "Des notes de terrain suffisamment longues pour passer." }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toBe("Contenu du rapport.");
  });

  it("returns 502 when the LLM call fails", async () => {
    vi.mocked(generateReport).mockRejectedValue(new LlmError("upstream down", 500));

    const response = await POST(makeRequest({ notes: "Des notes de terrain suffisamment longues pour passer." }));
    expect(response.status).toBe(502);
  });
});
