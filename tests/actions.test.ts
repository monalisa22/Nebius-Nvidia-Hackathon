import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../lib/repository", () => ({
  importSource: vi.fn(async () => 1), ingestEvidence: vi.fn(async () => 1),
  prepareDraft: vi.fn(async () => undefined), approveAndSaveDraft: vi.fn(),
  approveCandidate: vi.fn(), deleteSource: vi.fn(), rejectCandidate: vi.fn(),
  resetDemoWorkspace: vi.fn(), resolveUncertain: vi.fn(),
}));

import { importSourceAction, ingestEvidenceAction, prepareDraftAction } from "../app/actions";
import { importSource, ingestEvidence, prepareDraft } from "../lib/repository";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_PROVIDER", "token-factory");
});
afterEach(() => vi.unstubAllEnvs());

describe("live context consent", () => {
  const state = { message: "", error: false };
  it.each([importSourceAction, ingestEvidenceAction, prepareDraftAction])("rejects a forged request without consent", async (action) => {
    const result = await action(state, new FormData());
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/context access/);
    expect(importSource).not.toHaveBeenCalled();
    expect(ingestEvidence).not.toHaveBeenCalled();
    expect(prepareDraft).not.toHaveBeenCalled();
  });
  it("accepts a validated, consented source", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ consent: "on", title: "Test note", project: "Atlas", content: "When Rina approves, prepare a follow-up." })) form.set(key, value);
    expect((await importSourceAction(state, form)).error).toBe(false);
    expect(importSource).toHaveBeenCalledOnce();
  });
  it("does not send oversized input to a model", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ consent: "on", title: "Note", project: "Atlas", content: "a".repeat(20001) })) form.set(key, value);
    expect((await importSourceAction(state, form)).error).toBe(true);
    expect(importSource).not.toHaveBeenCalled();
  });
});
