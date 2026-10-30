import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenFactoryPersonalAiProvider, verifyQuote } from "../lib/ai/token-factory";
import { getPersonalAiProvider, providerStatus } from "../lib/ai/provider";

const model = "nvidia/nemotron-3-super-120b-a12b";
const evidence = "Maya: The final Project Mercury scope is approved.";
const input = { triggerText: "Maya approves the final Project Mercury scope", expectedActor: "Maya", evidence };
const result = { outcome: "satisfied", explanation: "Explicit approval matches the trigger.", sourceQuote: evidence };

function mockProvider(value: unknown = result, overrides: Record<string, unknown> = {}) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "tool_calls", message: {
      role: "assistant", content: null,
      tool_calls: [{ id: "call-1", type: "function", function: { name: "report_result", arguments: JSON.stringify(value) } }],
    }, ...overrides }],
  }), { status: 200, headers: { "content-type": "application/json" } }));
  const client = new OpenAI({ apiKey: "test-key", fetch: fetcher, maxRetries: 0 });
  return { provider: new TokenFactoryPersonalAiProvider(model, client), fetcher };
}

afterEach(() => vi.unstubAllEnvs());

describe("Token Factory contract", () => {
  it("validates an evidence response and limits the model to a reporting tool", async () => {
    const { provider, fetcher } = mockProvider();
    expect(await provider.evaluateEvidence(input)).toEqual(result);
    const init = (fetcher.mock.calls as unknown as [unknown, RequestInit][])[0][1];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(model);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe("report_result");
    expect(body.tool_choice.function.name).toBe("report_result");
    expect(JSON.parse(body.messages[1].content)).toEqual(input);
  });

  it.each([
    { ...result, outcome: "approved" },
    { ...result, explanation: "" },
    { ...result, sourceQuote: "invented quote" },
    { ...result, execute: "send_message" },
  ])("rejects invalid or ungrounded evidence: %j", async (value) => {
    await expect(mockProvider(value).provider.evaluateEvidence(input)).rejects.toThrow();
  });

  it("rejects truncated output", async () => {
    await expect(mockProvider(result, { finish_reason: "length" }).provider.evaluateEvidence(input)).rejects.toThrow("complete result");
  });

  it("rejects unrequested model tool calls", async () => {
    await expect(mockProvider(result, { message: { tool_calls: [{ type: "function", function: { name: "send_message", arguments: "{}" } }] } }).provider.evaluateEvidence(input)).rejects.toThrow("complete result");
  });

  it("checks every extracted quote", async () => {
    const candidate = { commitmentText: "Prepare proposal", triggerText: "Maya approves", actor: "Maya", confidence: 0.9, sourceQuote: "not in the note" };
    await expect(mockProvider({ candidates: [candidate] }).provider.extractCandidates(evidence)).rejects.toThrow("quote");
  });

  it("supports notes without commitments", async () => {
    expect(await mockProvider({ candidates: [] }).provider.extractCandidates("No actions.")).toEqual([]);
  });

  it("never exposes provider error bodies", async () => {
    const client = new OpenAI({ apiKey: "test-key", maxRetries: 0, fetch: async () => new Response(
      JSON.stringify({ error: { message: "SECRET_DO_NOT_DISPLAY" } }), { status: 401, headers: { "content-type": "application/json" } },
    ) });
    await expect(new TokenFactoryPersonalAiProvider(model, client).evaluateEvidence(input)).rejects.toThrow("authentication failed");
  });

  it("requires exact nonempty source substrings", () => {
    expect(() => verifyQuote("Approved? Not approved.", "Approved.")).toThrow();
    expect(() => verifyQuote(evidence, " ")).toThrow();
  });
});

describe("explicit provider selection", () => {
  it("keeps fixture mode even with a configured key", () => {
    vi.stubEnv("AI_PROVIDER", "fixture");
    vi.stubEnv("NEBIUS_API_KEY", "test-key");
    vi.stubEnv("NEBIUS_MODEL", model);
    expect(getPersonalAiProvider().name).toBe("fixture");
    expect(providerStatus().model).toBeNull();
  });
  it("fails closed on missing live credentials, without fixture fallback", () => {
    vi.stubEnv("AI_PROVIDER", "token-factory");
    vi.stubEnv("NEBIUS_API_KEY", "");
    vi.stubEnv("NEBIUS_MODEL", model);
    expect(providerStatus().configured).toBe(false);
    expect(() => getPersonalAiProvider()).toThrow("NEBIUS_API_KEY");
  });
  it("rejects unknown provider modes and non-NVIDIA models", () => {
    vi.stubEnv("AI_PROVIDER", "unknown");
    expect(() => getPersonalAiProvider()).toThrow("AI_PROVIDER");
    expect(() => new TokenFactoryPersonalAiProvider("other/model")).toThrow("NVIDIA");
  });
});
