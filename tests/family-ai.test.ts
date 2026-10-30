import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyStore } from "../lib/anubandh/store";
import type { Member } from "../lib/anubandh/types";
import { generateBrief } from "../lib/anubandh/ai";
import { workOnce } from "../lib/anubandh/worker";
import { CompanionService } from "../lib/togetherly/service";
import { processExtraction } from "../lib/togetherly/worker";
import { RitualService } from "../lib/togetherly/ritual-service";
import { processRitual } from "../lib/togetherly/ritual-ai";
import { sourceQuote } from "../lib/ai/source-quote";
import { familyModelOptions } from "../lib/ai/family-response";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../lib/ai/token-factory", () => ({ createTokenFactoryClient: () => ({ chat: { completions: { create } } }) }));

const caption = "A few months ago, I picked up a guitar for the first time. Holding the chords correctly felt difficult.\n\nI practiced a little every day, replaying tutorials and trying again. Today, I played my first full song from start to finish. Hearing a melody come from the guitar felt amazing. I want to learn more songs.";
const flattened = caption.replace(/\s+/g, " ");
let store: FamilyStore, owner: Member, ruhi: Member, rohan: Member, sourceId: string;
let companion: CompanionService, rituals: RitualService;
function response(name: string, content: unknown, finish_reason = "stop") {
  return { choices: [{ finish_reason, message: { tool_calls: [{ type: "function", function: { name, arguments: JSON.stringify(content) } }] } }] };
}
function extraction() { companion.command(owner, { action: "extract", sourceId }); }
function ritual() {
  const id = rituals.command(owner, { action: "ritual-save", skill: "reconnect", recipientId: ruhi.id, sourceIds: [sourceId], cadence: "manual", allowAction: true, expiresAt: null, engine: "direct" }).id as string;
  rituals.command(owner, { action: "ritual-run", id });
  return id;
}
function ritualOutput() {
  // Shape and text observed from the live synthetic catch-up, including flattened paragraphs.
  return { title: "Ruhi's first guitar song", moments: [{ sourceId, quote: flattened,
    caption: "Ruhi shared her first guitar song experience.", question: "Ruhi, what part of playing the guitar made you feel amazing?" }],
    proposal: { tool: "reply.offer", text: "I'd love to hear the song you learned, dear.", sourceIds: [sourceId] } };
}
beforeEach(() => {
  store = new FamilyStore(":memory:");
  companion = new CompanionService(store); rituals = new RitualService(store);
  owner = store.createFamily({ name: "Monalisa", familyName: "Synthetic", email: "owner@example.test", password: "synthetic-password-123" });
  const join = (name: string, relationship: string) => store.join(store.invite(owner, { name, relationship, view: true, contribute: true, schedule: true }), `${name}@example.test`, "synthetic-password-123");
  ruhi = join("Ruhi", "Daughter"); rohan = join("Rohan", "Son");
  sourceId = store.addMemory(ruhi, { title: "Guitar", caption, kind: "story", personIds: [ruhi.person_id!], audience: ["*"] });
  store.reviewMemory(owner, sourceId, "approved", 1);
  store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: true });
  vi.stubEnv("AI_PROVIDER", "token-factory");
  vi.stubEnv("NEBIUS_API_KEY", "test-key");
  vi.stubEnv("NEBIUS_MODEL", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
  create.mockReset();
});
afterEach(() => { store.db.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("source formatting recovery", () => {
  it("restores original line breaks and whitespace without rewriting the source", () => {
    expect(sourceQuote(caption, flattened)).toBe(caption);
    expect(sourceQuote("Ruhi\r\n\r\nplayed\tA+B (intro).", "Ruhi played A+B (intro).")).toBe("Ruhi\r\n\r\nplayed\tA+B (intro).");
  });
  it.each(["", "   ", "I won a guitar contest.", flattened.replace("difficult", "easy"), flattened.replace("I practiced", "Ruhi practiced"), "I picked up a guitar. I want to learn more songs."])("rejects invented, edited or stitched quotes: %s", quote => {
    expect(sourceQuote(caption, quote)).toBeNull();
  });
  it("does not treat model text as a regular expression", () => {
    expect(sourceQuote("private data here", ".* data .* ")).toBeNull();
  });
});

describe("family AI request to stored result", () => {
  it("replays the live briefing through validation and persistence with exact source formatting", async () => {
    create.mockResolvedValue(response("report_brief", { items: [{ sourceId, quote: flattened,
      summary: "Ruhi played her first full guitar song after months of practice.",
      starters: ["Ruhi, which song did you play?", "What was it like hearing the whole melody come together?"] }] }));
    store.queue(owner, "briefing", null);
    await workOnce(store);
    expect(JSON.parse(store.artifacts(owner)[0].content).items[0]).toMatchObject({ quote: caption, text: "Ruhi played her first full guitar song after months of practice." });
    const request = create.mock.calls[0][0];
    expect(request.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(request.parallel_tool_calls).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("replays the live catch-up, keeping approval mandatory before delivery", async () => {
    create.mockResolvedValue(response("prepare_connection", ritualOutput()));
    ritual(); await processRitual(rituals);
    const run = rituals.snapshot(owner).runs[0];
    expect(run.status).toBe("ready");
    expect(run.result?.moments[0].quote).toBe(caption);
    expect(store.messages(ruhi)).toHaveLength(0);
    rituals.command(owner, { action: "ritual-approve", id: run.id, text: "Ruhi, which song did you play?" });
    expect(store.messages(ruhi)).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].chat_template_kwargs.enable_thinking).toBe(false);
  });
  it("attributes first-person updates to their contributor even when another person is tagged", async () => {
    store.editMemory(owner, sourceId, 2, "Guitar", caption, null, ["*"], [rohan.person_id!]);
    create.mockResolvedValue(response("report_details", { facts: [] }));
    extraction(); await processExtraction(companion);
    const payload = JSON.parse(create.mock.calls[0][0].messages[1].content);
    expect(payload.contributedBy).toEqual({ name: "Ruhi", personId: ruhi.person_id });
    expect(payload.people.map((p: { personId: string }) => p.personId)).toEqual([rohan.person_id]);
    expect(JSON.stringify(payload)).not.toContain("email");
    expect(create.mock.calls[0][0].chat_template_kwargs.enable_thinking).toBe(false);
  });
  it("restores extraction evidence and requires review before showing it to relatives", async () => {
    create.mockResolvedValue(response("report_details", { facts: [{ personId: ruhi.person_id, category: "milestone", quote: flattened }] }));
    extraction(); await processExtraction(companion);
    expect(companion.facts(owner)[0]).toMatchObject({ quote: caption, status: "pending" });
    expect(companion.facts(rohan)).toHaveLength(0);
    companion.command(owner, { action: "fact-review", id: companion.facts(owner)[0].id, decision: "approved" });
    expect(companion.facts(rohan)).toHaveLength(1);
  });
  it("skips paid extraction when no people are tagged", async () => {
    store.editMemory(owner, sourceId, 2, "Guitar", caption, null, ["*"], []);
    extraction(); await processExtraction(companion);
    expect(create).not.toHaveBeenCalled();
    expect(store.one("SELECT status,provider FROM companion_jobs")).toEqual({ status: "completed", provider: "no-sources" });
  });
  it.each(["extract", "ritual", "brief"])("stops on quota errors and exposes a useful message for %s", async task => {
    create.mockRejectedValue(new OpenAI.RateLimitError(429, { message: "PRIVATE_PROVIDER_BODY" }, "PRIVATE_PROVIDER_BODY", new Headers()));
    if (task === "extract") { extraction(); await processExtraction(companion); }
    else if (task === "ritual") { ritual(); await processRitual(rituals); }
    else { store.queue(owner, "briefing", null); await workOnce(store); }
    const table = task === "extract" ? "companion_jobs" : task === "ritual" ? "ritual_runs" : "jobs";
    const job = store.one<{ status: string; error: string }>(`SELECT status,error FROM ${table}`)!;
    expect(job.status).toBe("failed"); expect(job.error).toContain("quota");
    expect(job.error).not.toContain("PRIVATE_PROVIDER_BODY"); expect(create).toHaveBeenCalledTimes(1);
  });
  it("preserves source-validation failures without allowing a catch-up action", async () => {
    const output = ritualOutput(); output.moments[0].quote = "Ruhi won a competition.";
    create.mockResolvedValue(response("prepare_connection", output));
    ritual(); await processRitual(rituals);
    expect(rituals.snapshot(owner).runs[0]).toMatchObject({ status: "failed", error: "The preparation did not match its chosen sources.", result: null });
    expect(store.messages(ruhi)).toHaveLength(0);
  });
  it("rejects truncated model output without silently retrying", async () => {
    create.mockResolvedValue(response("report_details", { facts: [] }, "length"));
    extraction(); await processExtraction(companion);
    expect(store.one<{ error: string }>("SELECT error FROM companion_jobs")?.error).toContain("response limit");
    expect(companion.facts(owner)).toHaveLength(0); expect(create).toHaveBeenCalledTimes(1);
  });
  it("does not send memories after AI consent is withdrawn", async () => {
    extraction(); store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: false });
    await processExtraction(companion);
    expect(create).not.toHaveBeenCalled();
  });
  it("maps authentication and malformed output to safe errors", async () => {
    store.queue(owner, "briefing", null); const context = store.context(store.claimJob()!);
    create.mockRejectedValueOnce(new OpenAI.AuthenticationError(401, { message: "PRIVATE" }, "PRIVATE", new Headers()));
    await expect(generateBrief(context)).rejects.toThrow("access was denied");
    create.mockResolvedValueOnce(response("report_brief", {}));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(generateBrief(context)).rejects.toThrow("missing or oversized fields");
  });
  it("only applies the Nano thinking override to the known Nano model", () => {
    expect(familyModelOptions("nvidia/another-model")).not.toHaveProperty("chat_template_kwargs");
  });
});
