import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/anthropic", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anthropic")>("@/lib/anthropic");
  return {
    ...actual,
    challengeReport: vi.fn(),
  };
});

import { challengeReport, LlmError } from "@/lib/anthropic";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/rapports/challenge", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/v1/rapports/challenge", () => {
  beforeEach(() => {
    vi.mocked(challengeReport).mockReset();
  });

  it("returns 400 when notes are missing", async () => {
    const response = await POST(makeRequest({ report: "un rapport" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when report is missing", async () => {
    const response = await POST(makeRequest({ notes: "des notes" }));
    expect(response.status).toBe(400);
  });

  it("returns 200 with the challenge items on success", async () => {
    vi.mocked(challengeReport).mockResolvedValue([{ passage: "il semblait triste", question: "Sur quoi ?" }]);

    const response = await POST(makeRequest({ notes: "des notes", report: "un rapport" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
  });

  it("returns 502 when the LLM call fails", async () => {
    vi.mocked(challengeReport).mockRejectedValue(new LlmError("upstream down", 500));

    const response = await POST(makeRequest({ notes: "des notes", report: "un rapport" }));
    expect(response.status).toBe(502);
  });
});
