import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { FamilyStore } from "../lib/anubandh/store";
import type { Member } from "../lib/anubandh/types";
import { PhotoService } from "../lib/togetherly/photo-service";
import { processPhoto, readPhotoReport } from "../lib/togetherly/photo-ai";
import { CompanionService } from "../lib/togetherly/service";
import { approvedPhotoEvidence } from "../lib/togetherly/photo-evidence";
import { generateBrief, validateBrief } from "../lib/anubandh/ai";
import { RitualService, validateRitual } from "../lib/togetherly/ritual-service";
import { prepareRitual } from "../lib/togetherly/ritual-ai";
import type { PhotoJob, PhotoResult } from "../lib/togetherly/photo-contracts";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../lib/ai/token-factory", () => ({ createTokenFactoryClient: () => ({ chat: { completions: { create } } }) }));
let store: FamilyStore, service: PhotoService, owner: Member, daughter: Member, son: Member, sourceId: string, directory: string;
const original = "Diwali at home with my family. We made the decorations together.";
const output: PhotoResult = { description: "Flower garlands and small lamps decorate a room.", observations: ["Flowers hang beside a doorway."], themes: ["celebrations", "diwali"], storyPrompt: "Which decoration has a story behind it?" };
function setupPhoto(caption = original, audience = ["*"]) {
  const mediaId = store.saveMedia(daughter, "image/jpeg", 100);
  store.run("UPDATE media SET filename='demo:garden.jpg' WHERE id=?", mediaId);
  const source = store.addMemory(daughter, { title: "A family celebration", caption, kind: "photo", personIds: [daughter.person_id!, son.person_id!], audience, mediaId });
  store.reviewMemory(owner, source, "approved", 1);
  return source;
}
function allow() { service.command(owner, { action: "photo-permission", enabled: true }); }
function ready(source = sourceId) {
  service.command(owner, { action: "photo-analyze", sourceId: source });
  const job = service.claim()!;
  service.commit(job, output, "token-factory", "nvidia/vision-test");
  return store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE id=?", job.id)!;
}
function approve(source = sourceId) {
  const job = ready(source);
  service.command(owner, { action: "photo-review", id: job.id, revision: job.revision, content: output });
  return job.id;
}
function briefContext() { store.queue(owner, "briefing", null); const job = store.claimJob()!; return { job, context: store.context(job) }; }
beforeEach(() => {
  store = new FamilyStore(":memory:"); service = new PhotoService(store);
  directory = mkdtempSync(path.join(tmpdir(), "togetherly-photo-test-"));
  vi.stubEnv("ANUBANDH_STORAGE_PATH", directory);
  vi.stubEnv("AI_PROVIDER", "token-factory"); vi.stubEnv("NEBIUS_API_KEY", "synthetic-test-key");
  vi.stubEnv("NEBIUS_VISION_MODEL", "nvidia/Nemotron-3.5-Super-VL");
  owner = store.createFamily({ name: "Monalisa", familyName: "Synthetic", email: "owner@example.test", password: "synthetic-password-123" });
  const join = (name: string, relationship: string) => store.join(store.invite(owner, { name, relationship, view: true, contribute: true, schedule: true }), `${name}@example.test`, "synthetic-password-123");
  daughter = join("Ruhi", "Daughter"); son = join("Rohan", "Son");
  store.run("UPDATE families SET is_demo=1 WHERE id=?", owner.family_id);
  store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: true });
  sourceId = setupPhoto(); create.mockReset();
});
afterEach(() => { store.db.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(directory, { recursive: true, force: true }); });

describe("photo understanding lifecycle", () => {
  it("requires separate photo consent and preserves all original story details", () => {
    new CompanionService(store).command(owner, { action: "memory-context", sourceId, revision: 2, occurredOn: "2025-10-20", place: "Home", legacy: true });
    expect(() => service.command(owner, { action: "photo-analyze", sourceId })).toThrow(/photo processing/);
    expect(() => service.command(daughter, { action: "photo-permission", enabled: true })).toThrow();
    allow(); approve();
    expect(store.memory(owner, sourceId)).toMatchObject({ caption: original, title: "A family celebration", revision: 3 });
    expect(new CompanionService(store).snapshot(owner).memoryContext[0]).toMatchObject({ place: "Home", occurred_on: "2025-10-20", legacy: 1 });
    expect(service.snapshot(owner).collections.map(c => c.theme)).toEqual(["celebrations", "diwali"]);
  });
  it("does not expose unreviewed suggestions to other relatives or AI context", () => {
    allow(); ready();
    expect(service.snapshot(son).analyses).toHaveLength(0);
    expect(approvedPhotoEvidence(store.db, store.memory(owner, sourceId))).toBeUndefined();
    expect(briefContext().context.sources[0].photoEvidence).toBeUndefined();
    expect(() => service.command(son, { action: "photo-analyze", sourceId })).toThrow(/contributed/);
  });
  it("reuses a completed analysis without another paid job", () => {
    allow(); const id = approve();
    expect(service.command(owner, { action: "photo-analyze", sourceId })).toEqual({ id });
    expect(service.claim()).toBeNull(); expect(store.all("SELECT * FROM photo_analyses")).toHaveLength(1);
  });
  it("allows an empty photo caption but never erases one or allows empty written stories", async () => {
    const photo = setupPhoto(""); allow(); approve(photo);
    vi.stubEnv("AI_PROVIDER", "fixture");
    const { job, context } = briefContext(); const result = await generateBrief(context);
    store.commitJob(job, context.fingerprint, result.content, result.provider, result.model);
    expect(result.content.items.find(i => i.sourceId === photo)?.evidenceId).toBeTruthy();
    expect(store.memory(owner, photo).caption).toBe("");
    expect(() => store.addMemory(owner, { title: "Empty story", kind: "story", caption: "", personIds: [], audience: [] })).toThrow(/caption/);
  });
  it("keeps photo evidence distinct from original quotes in briefings", () => {
    allow(); const evidenceId = approve(); const { job, context } = briefContext();
    const item = { sourceId, evidenceId, quote: output.description, summary: "A family photograph shows flower garlands and lamps.", starters: ["Which decoration has a story behind it?", "What would you like to share about the flowers?"] };
    const brief = validateBrief({ items: [item] }, context);
    expect(brief.items[0].evidenceId).toBe(evidenceId);
    expect(() => validateBrief({ items: [{ ...item, evidenceId: null }] }, context)).toThrow(/source/);
    expect(() => validateBrief({ items: [{ ...item, evidenceId: son.id }] }, context)).toThrow(/source/);
    store.commitJob(job, context.fingerprint, brief, "token-factory", "nvidia/test");
    expect(store.artifacts(owner)).toHaveLength(1);
    const current = store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE id=?", evidenceId)!;
    service.command(owner, { action: "photo-dismiss", id: evidenceId, revision: current.revision });
    expect(store.artifacts(owner)).toHaveLength(0);
  });
  it("carries reviewed photo evidence into direct and Hermes ritual packets", async () => {
    allow(); const evidenceId = approve(); const rituals = new RitualService(store);
    const id = rituals.command(owner, { action: "ritual-save", skill: "reconnect", engine: "direct", recipientId: daughter.id, sourceIds: [sourceId], cadence: "manual", allowAction: false, expiresAt: null }).id as string;
    rituals.command(owner, { action: "ritual-run", id }); const run = rituals.claim()!; const packet = rituals.runContext(run).packet;
    expect(packet.sources[0].photoEvidence?.id).toBe(evidenceId);
    const result = validateRitual({ title: "Our decorations", moments: [{ sourceId, evidenceId, quote: output.description, caption: "The photograph shows garlands and lamps.", question: "Ruhi, which decoration has a story behind it?" }], proposal: { tool: "none", text: "", sourceIds: [] } }, packet);
    rituals.commit(run, result, "token-factory", "nvidia/test");
    expect(rituals.snapshot(owner).runs[0].status).toBe("ready");
    service.command(owner, { action: "photo-permission", enabled: false });
    expect(rituals.snapshot(owner).runs[0].result).toBeNull();
    expect(service.snapshot(owner).collections).toHaveLength(0);
    expect(store.memory(owner, sourceId).caption).toBe(original);
    vi.stubEnv("AI_PROVIDER", "fixture");
    expect((await prepareRitual(packet)).provider).toBe("fixture");
  });
  it.each(["edit", "delete", "consent", "photo-consent"])("rejects an in-flight result after %s", change => {
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); const job = service.claim()!;
    if (change === "edit") store.editMemory(owner, sourceId, 2, "Changed", "Corrected story", null, ["*"], []);
    if (change === "delete") store.deleteMemory(owner, sourceId);
    if (change === "consent") store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: false });
    if (change === "photo-consent") service.command(owner, { action: "photo-permission", enabled: false });
    expect(service.commit(job, output, "token-factory", "nvidia/test")).toBe(false);
  });
  it("rejects late and cancelled results, without another automatic attempt", () => {
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); const job = service.claim()!;
    service.command(owner, { action: "photo-cancel", id: job.id });
    expect(service.commit(job, output, "token-factory", "nvidia/test")).toBe(false);
    expect(service.claim()).toBeNull();
  });
  it("limits new requests across the family to ten per day", () => {
    allow();
    for (let i = 0; i < 10; i++) service.command(owner, { action: "photo-analyze", sourceId: setupPhoto() });
    expect(() => service.command(owner, { action: "photo-analyze", sourceId })).toThrow();
  });
  it("hides private collections from viewers without source access", () => {
    allow(); const privatePhoto = setupPhoto(original, []); approve(privatePhoto);
    expect(service.snapshot(son).collections).toHaveLength(0);
    expect(service.snapshot(owner).collections).toHaveLength(2);
    const stranger = store.createFamily({ name: "Other", familyName: "Other", email: "other@example.test", password: "synthetic-password-123" });
    expect(() => service.command(stranger, { action: "photo-analyze", sourceId })).toThrow();
  });
  it("builds collections from reviewed themes and orders confirmed dates, not upload times", () => {
    const older = setupPhoto(); const companion = new CompanionService(store);
    companion.command(owner, { action: "memory-context", sourceId: older, revision: 2, occurredOn: "2020-11-14", place: "", legacy: false });
    companion.command(owner, { action: "memory-context", sourceId, revision: 2, occurredOn: "2025-10-20", place: "", legacy: false });
    allow(); approve(); approve(older);
    const collection = service.snapshot(owner).collections.find(c => c.theme === "diwali")!;
    expect(collection.sourceIds).toEqual([older, sourceId]);
    companion.command(owner, { action: "walk-create", title: collection.title, sourceIds: collection.sourceIds });
    expect(companion.snapshot(owner).walks[0].items.map(i => i.source_id)).toEqual([older, sourceId]);
  });
});

describe("photo worker and provider", () => {
  it("accepts a complete JSON photo description and rejects incomplete or action-bearing output", () => {
    const response = (content: string, finish_reason = "stop") => ({ choices: [{ finish_reason, message: { content } }] }) as OpenAI.ChatCompletion;
    expect(readPhotoReport(response(JSON.stringify(output)))).toEqual(output);
    expect(readPhotoReport(response("```json\n" + JSON.stringify(output) + "\n```"))).toEqual(output);
    expect(() => readPhotoReport(response(JSON.stringify(output), "length"))).toThrow();
    expect(() => readPhotoReport(response(JSON.stringify({ ...output, action: "send" })))).toThrow();
    expect(() => readPhotoReport(response(JSON.stringify({ description: "An incomplete fragment" })))).toThrow();
    expect(() => readPhotoReport(response("not JSON"))).toThrow();
  });
  it("requests one bounded image analysis and keeps it pending review", async () => {
    create.mockResolvedValue({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] });
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); await processPhoto(service);
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("nvidia/Nemotron-3.5-Super-VL"); expect(request.max_tokens).toBe(1800);
    expect(request.tools).toBeUndefined();
    expect(request.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(request.messages[1].content[0].text).toContain(original);
    expect(service.snapshot(owner).analyses[0].status).toBe("ready");
    expect(store.memory(owner, sourceId).caption).toBe(original);
  });
  it("does not call the model for missing images", async () => {
    const memory = store.memory(owner, sourceId);
    store.run("UPDATE media SET filename=id WHERE id=?", memory.media_id);
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); await processPhoto(service);
    expect(create).not.toHaveBeenCalled();
    expect(service.snapshot(owner).analyses[0].error).toContain("missing");
  });
  it("stops on quota failures without retrying or exposing provider text", async () => {
    create.mockRejectedValue(new OpenAI.RateLimitError(429, { message: "PRIVATE" }, "PRIVATE", new Headers()));
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); await processPhoto(service);
    expect(service.snapshot(owner).analyses[0]).toMatchObject({ status: "failed", error: expect.stringContaining("quota") });
    await processPhoto(service); expect(create).toHaveBeenCalledTimes(1);
  });
  it("rejects model-requested actions and malformed output", async () => {
    create.mockResolvedValue({ choices: [{ finish_reason: "stop", message: { tool_calls: [{ type: "function", function: { name: "send_message", arguments: "{}" } }] } }] });
    allow(); service.command(owner, { action: "photo-analyze", sourceId }); await processPhoto(service);
    expect(service.snapshot(owner).analyses[0].status).toBe("failed");
    expect(store.messages(daughter)).toHaveLength(0);
  });
});
