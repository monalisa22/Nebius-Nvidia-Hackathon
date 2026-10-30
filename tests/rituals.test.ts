import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FamilyStore } from "../lib/anubandh/store";
import type { Member } from "../lib/anubandh/types";
import { RitualService, validateRitual } from "../lib/togetherly/ritual-service";
import { HermesTools } from "../lib/togetherly/hermes";
import { defaultCallSkill, type RitualResult, type RitualRun } from "../lib/togetherly/ritual-contracts";
import { hermesStatus } from "../lib/togetherly/hermes-status";

vi.mock("../lib/togetherly/hermes-status", () => ({ hermesStatus: vi.fn(() => ({ available: true, enabled: true, installed: true })), hermesPython: () => "unused" }));
let store: FamilyStore, service: RitualService, owner: Member, daughter: Member, son: Member;
let sourceId: string;
const DAY = 86400000;
function save(overrides = {}) {
  return service.command(owner, { action: "ritual-save", skill: "call", recipientId: daughter.id,
    sourceIds: [sourceId], cadence: "manual", allowAction: true, expiresAt: Date.now() + 30 * DAY, engine: "hermes", ...overrides }).id as string;
}
function claim(ritualId = save()) {
  service.command(owner, { action: "ritual-run", id: ritualId });
  return service.claim()!;
}
function result(tool: "reply.offer" | "walk.offer" | "none" = "reply.offer"): RitualResult {
  return { title: "A song to talk about", moments: [{ sourceId, quote: "I played my first full song on guitar.", caption: "Meera played her first full song on guitar.", question: "Which song did you play, Meera?" }],
    proposal: tool === "none" ? { tool, text: "", sourceIds: [] } : { tool, text: "Meera, which song did you play on your guitar?", sourceIds: [sourceId] } };
}
function ready(ritualId = save()) {
  const job = claim(ritualId);
  service.commit(job, result(), "hermes-nebius", "nvidia/test");
  return job;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-26T09:00:00Z"));
  vi.mocked(hermesStatus).mockReturnValue({ enabled: true, installed: true, available: true, revision: "test" });
  store = new FamilyStore(":memory:"); service = new RitualService(store);
  owner = store.createFamily({ name: "Asha", familyName: "Synthetic", email: "asha@example.test", password: "long-test-password" });
  const invite = (name: string, relationship: string) => store.join(store.invite(owner, { name, relationship, view: true, contribute: true, schedule: true }), `${name}@example.test`, "long-test-password");
  daughter = invite("Meera", "Daughter"); son = invite("Rohan", "Son");
  sourceId = store.addMemory(daughter, { title: "My guitar", caption: "I played my first full song on guitar.", kind: "story", personIds: [daughter.person_id!], audience: ["*"] });
  store.reviewMemory(owner, sourceId, "approved", 1);
  store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true });
});
afterEach(() => { store.db.close(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("ritual permissions and lifecycle", () => {
  it("requires consent, an available runtime, and chosen approved sources", () => {
    store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: false });
    expect(() => save()).toThrow(/permission/);
    store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true });
    vi.mocked(hermesStatus).mockReturnValue({ enabled: false, installed: true, available: false, revision: "test" });
    expect(() => save()).toThrow(/Hermes/);
    expect(() => save({ engine: "direct" })).not.toThrow();
    expect(() => save({ engine: "direct", sourceIds: [] })).toThrow();
    expect(() => save({ engine: "direct", recipientId: son.id })).toThrow(/memories/);
  });
  it("keeps routines and preparations private to their owner", () => {
    const job = ready();
    expect(service.snapshot(son).rituals).toHaveLength(0);
    expect(service.snapshot(daughter).runs).toHaveLength(0);
    expect(() => service.command(son, { action: "ritual-approve", id: job.id, text: "Hello" })).toThrow();
    expect(() => service.command(son, { action: "ritual-run", id: job.ritual_id })).toThrow();
  });
  it("blocks another family's recipient and memories", () => {
    const other = store.createFamily({ name: "Other", familyName: "Other", email: "other@example.test", password: "long-test-password" });
    expect(() => save({ recipientId: other.id })).toThrow();
    const foreign = store.addMemory(other, { title: "Private", caption: "Secret", kind: "story", personIds: [], audience: ["*"] });
    expect(() => save({ sourceIds: [foreign] })).toThrow();
  });
  it("rejects pending memories and source access removed from a relative", () => {
    const pending = store.addMemory(daughter, { title: "Pending", caption: "Not yet approved", kind: "story", personIds: [daughter.person_id!], audience: ["*"] });
    expect(() => save({ sourceIds: [pending] })).toThrow(/approved/);
    const id = service.command(son, { action: "ritual-save", skill: "call", engine: "hermes", recipientId: daughter.id, sourceIds: [sourceId], cadence: "manual", allowAction: false, expiresAt: null }).id as string;
    store.setAccess(owner, son.id, { active: true, view: false, contribute: true, schedule: false, expiresAt: null });
    expect(() => service.command(son, { action: "ritual-run", id })).toThrow(/viewing/);
  });
  it("prevents duplicate pending jobs and duplicate delivery", () => {
    const id = save(); const job = ready(id);
    expect(store.messages(daughter)).toHaveLength(0);
    const approval = { action: "ritual-approve", id: job.id, text: "Meera, which song did you play?" };
    const first = service.command(owner, approval);
    expect(service.command(owner, approval)).toEqual(first);
    expect(store.messages(daughter)).toHaveLength(1);
    expect(store.messages(daughter)[0].text).toBe(approval.text);
    const next = service.command(owner, { action: "ritual-run", id });
    expect(service.command(owner, { action: "ritual-run", id })).toEqual(next);
  });
  it("rejects private-source disclosure even if the model cites a public source", () => {
    const privateId = store.addMemory(owner, { title: "Private", caption: "A private family detail.", kind: "story", personIds: [daughter.person_id!], audience: [] });
    store.reviewMemory(owner, privateId, "approved", 1);
    const job = ready(save({ sourceIds: [sourceId, privateId] }));
    expect(() => service.command(owner, { action: "ritual-approve", id: job.id, text: "Private detail" })).toThrow(/private/);
    expect(store.messages(daughter)).toHaveLength(0);
  });
  it.each(["edit", "delete", "consent", "pause", "recipient"])("invalidates prepared content after %s", action => {
    const job = ready();
    if (action === "edit") store.editMemory(owner, sourceId, 2, "Changed", "Corrected memory.", null, ["*"], [daughter.person_id!]);
    if (action === "delete") store.deleteMemory(owner, sourceId);
    if (action === "consent") store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: false });
    if (action === "pause") service.command(owner, { action: "ritual-toggle", id: job.ritual_id, revision: 1, enabled: false });
    if (action === "recipient") store.setAccess(owner, daughter.id, { active: false, view: false, contribute: false, schedule: false, expiresAt: null });
    expect(service.snapshot(owner).runs[0].result).toBeNull();
    expect(() => service.command(owner, { action: "ritual-approve", id: job.id, text: "Hello" })).toThrow();
    expect(store.one<RitualRun>("SELECT * FROM ritual_runs WHERE id=?", job.id)?.result).toBeNull();
  });
  it("expires derived text without a browser being open", () => {
    ready(); vi.setSystemTime(Date.now() + 8 * DAY); service.tick();
    expect(store.all("SELECT * FROM ritual_runs")).toHaveLength(0);
  });
  it("deletes a ritual and derived results without deleting original memories", () => {
    const job = ready(); service.command(owner, { action: "ritual-delete", id: job.ritual_id });
    expect(service.snapshot(owner).runs).toHaveLength(0);
    expect(store.all("SELECT * FROM ritual_sources")).toHaveLength(0);
    expect(store.memory(owner, sourceId).caption).toContain("guitar");
  });
  it("creates private walks only after explicit approval", () => {
    const job = claim(save({ skill: "story", engine: "direct" }));
    service.commit(job, result("walk.offer"), "token-factory", "nvidia/test");
    expect(store.all("SELECT * FROM memory_walks")).toHaveLength(0);
    service.command(owner, { action: "ritual-approve", id: job.id, text: "Our music" });
    expect(store.all("SELECT * FROM memory_walk_items")).toHaveLength(1);
    expect(store.messages(daughter)).toHaveLength(0);
  });
});

describe("Hermes tool boundary and learning", () => {
  it("limits each tool to the chosen sources and exposes no sending or shell tools", () => {
    const tool = new HermesTools(service, claim());
    expect(tool.definitions().map(t => t.name)).toEqual(["load_call_skill", "get_approved_updates", "get_recent_preparations", "prepare_connection"]);
    expect(() => tool.handle("reply.send", {})).toThrow(/not permitted/);
    expect(() => tool.handle("get_approved_updates", { familyId: "other" })).toThrow();
    const packet = tool.handle("get_approved_updates", {}) as {
      sources: { id: string; caption: string; exactQuoteOptions: { evidenceId: string | null; quote: string }[] }[];
    };
    expect(packet.sources.map(s => s.id)).toEqual([sourceId]);
    expect(packet.sources[0].exactQuoteOptions).toContainEqual({
      evidenceId: null,
      quote: "I played my first full song on guitar.",
    });
    expect(packet.sources[0].exactQuoteOptions.every(option => packet.sources[0].caption.includes(option.quote))).toBe(true);
  });
  it("requires actual tool use before accepting a prepared result", () => {
    const tool = new HermesTools(service, claim());
    expect(() => tool.handle("prepare_connection", result())).toThrow(/load_call_skill/);
    for (const name of ["load_call_skill", "get_approved_updates", "get_recent_preparations"]) tool.handle(name, {});
    expect(tool.handle("prepare_connection", result())).toMatchObject({ accepted: true, delivery: "not-authorized" });
    expect(tool.receipt).toHaveLength(4);
    expect(store.messages(daughter)).toHaveLength(0);
  });
  it("gives Hermes actionable quote guidance without returning family text", () => {
    const tool = new HermesTools(service, claim());
    tool.handle("load_call_skill", {});
    tool.handle("get_approved_updates", {});
    const fabricated = result();
    fabricated.moments[0].quote = "I won a guitar competition.";
    expect(() => tool.handle("prepare_connection", fabricated)).toThrow(
      /exact contiguous excerpt.*do not paraphrase/i,
    );
  });
  it("does not require an empty history lookup for the first preparation", () => {
    const tool = new HermesTools(service, claim());
    expect(tool.handle("load_call_skill", {})).toMatchObject({ previousPreparationsAvailable: false });
    tool.handle("get_approved_updates", {});
    expect(tool.handle("prepare_connection", result())).toMatchObject({ accepted: true });
  });
  it("requires retrieval of still-current earlier questions on subsequent preparations", () => {
    const id = save(); ready(id);
    const tool = new HermesTools(service, claim(id));
    expect(tool.handle("load_call_skill", {})).toMatchObject({ previousPreparationsAvailable: true });
    tool.handle("get_approved_updates", {});
    expect(() => tool.handle("prepare_connection", result())).toThrow(/get_recent_preparations/);
    expect(tool.handle("get_recent_preparations", {})).toEqual([{ sourceId, question: result().moments[0].question }]);
    expect(tool.handle("prepare_connection", result())).toMatchObject({ accepted: true });
  });
  it("retains contributor identity and viewer-relative labels without inference", () => {
    const id = service.command(son, { action: "ritual-save", skill: "call", engine: "hermes", recipientId: daughter.id,
      sourceIds: [sourceId], cadence: "manual", allowAction: false, expiresAt: null }).id as string;
    service.command(son, { action: "ritual-run", id });
    const packet = service.runContext(service.claim()!).packet;
    expect(packet.viewer.name).toBe("Rohan");
    expect(packet.relative.relationshipToViewer.toLowerCase()).toMatch(/sis/);
    expect(packet.sources[0].contributedBy).toEqual({ name: "Meera", isViewer: false });
  });
  it("cancels an in-flight agent's tools and ignores its late completion", () => {
    const job = claim(); const tool = new HermesTools(service, job);
    service.command(owner, { action: "ritual-dismiss", id: job.id });
    expect(() => tool.handle("get_approved_updates", {})).toThrow(/cancelled/);
    expect(service.commit(job, result(), "hermes-nebius", "nvidia/test")).toBe(false);
  });
  it("does not include family memories during preference learning", () => {
    const id = save(); service.command(owner, { action: "ritual-learn", id, instruction: "Two memories and one question, please." });
    const job = service.claim()!; const tools = new HermesTools(service, job);
    expect(tools.definitions().map(t => t.name)).toEqual(["load_call_skill", "propose_skill"]);
    expect(() => tools.handle("get_approved_updates", {})).toThrow();
    tools.handle("load_call_skill", {});
    expect(() => tools.handle("propose_skill", { ...defaultCallSkill, canSend: true })).toThrow();
    const proposed = { ...defaultCallSkill, maxMoments: 2, questionCount: 1 };
    tools.handle("propose_skill", proposed);
    service.commit(job, tools.output, "hermes-nebius", "nvidia/test", tools.receipt);
    expect(service.snapshot(owner).rituals[0].preferences).toEqual(defaultCallSkill);
    service.command(owner, { action: "ritual-skill-approve", id: job.id });
    const current = service.snapshot(owner).rituals[0];
    expect(current.preferences).toEqual(proposed);
    expect(current).toMatchObject({ recipient_id: daughter.id, sourceIds: [sourceId], cadence: "manual", allow_action: 1, revision: 2 });
    expect(service.runContext(claim(id)).packet.preferences).toEqual(proposed);
  });
  it("rejects a stale routine approval after its configuration changes", () => {
    const id = save(); service.command(owner, { action: "ritual-learn", id, instruction: "One question, please." });
    const job = service.claim()!; service.commit(job, defaultCallSkill, "hermes-nebius", "nvidia/test");
    save({ id, revision: 1, allowAction: false });
    expect(() => service.command(owner, { action: "ritual-skill-approve", id: job.id })).toThrow(/current/);
    expect(store.one<RitualRun>("SELECT * FROM ritual_runs WHERE id=?", job.id)?.skill_proposal).toBeNull();
  });
  it("rejects fabricated quotes, unchosen sources, and unauthorized actions", () => {
    const job = claim(save({ allowAction: false })); const packet = service.runContext(job).packet;
    expect(() => validateRitual(result(), packet)).toThrow(/permission/);
    const fake = result("none"); fake.moments[0].quote = "I won a competition.";
    expect(() => validateRitual(fake, packet)).toThrow(/sources/);
    fake.moments[0].sourceId = son.id;
    expect(() => validateRitual(fake, packet)).toThrow();
    expect(() => validateRitual({ ...result("none"), execute: "shell" }, packet)).toThrow();
  });
  it("enforces the learned question and memory limits", () => {
    const packet = service.runContext(claim()).packet;
    const content = result("none"); content.moments[0].question = "";
    expect(() => validateRitual(content, packet)).toThrow(/question/);
  });
  it("rejects a caption that retells the relative's update as the viewer's own", () => {
    const packet = service.runContext(claim()).packet;
    const content = result("none"); content.moments[0].caption = "I played my first full song on guitar.";
    expect(() => validateRitual(content, packet)).toThrow(/first person/);
  });
  it("rejects conversation questions that switch away from the selected relative", () => {
    const packet = service.runContext(claim()).packet;
    const content = result("none"); content.moments[0].question = "Which song did you play, Aarav?";
    expect(() => validateRitual(content, packet)).toThrow(/selected relative/);
  });
});

describe("durable worker behavior", () => {
  it("reclaims an abandoned lease and rejects the first worker's late result", () => {
    const first = claim(); vi.setSystemTime(Date.now() + 300001); const second = service.claim()!;
    expect(second.lease_token).not.toEqual(first.lease_token);
    expect(service.commit(first, result(), "hermes-nebius", "nvidia/test")).toBe(false);
    expect(service.commit(second, result(), "hermes-nebius", "nvidia/test")).toBe(true);
  });
  it("bounds retries and allows a new explicit attempt", () => {
    const first = claim(); service.fail(first, true);
    vi.setSystemTime(Date.now() + 31000); const second = service.claim()!; service.fail(second, true);
    vi.setSystemTime(Date.now() + 61000); const third = service.claim()!; service.fail(third, true);
    expect(service.snapshot(owner).runs[0].status).toBe("failed");
    expect(service.claim()).toBeNull();
    expect(service.command(owner, { action: "ritual-run", id: first.ritual_id }).id).not.toEqual(first.id);
  });
  it("queues daily work once without browser polling", () => {
    save({ cadence: "daily" }); service.tick(); expect(service.claim()).toBeNull();
    vi.setSystemTime(Date.now() + DAY); service.tick(); service.tick();
    expect(store.all("SELECT * FROM ritual_runs")).toHaveLength(1);
  });
  it("prepares before a scheduled call once, not on every worker cycle", () => {
    save({ cadence: "before-call" }); store.scheduleCall(owner, daughter.person_id!, Date.now() + 30 * 60000, "");
    service.tick(); expect(service.claim()).toBeNull();
    vi.setSystemTime(Date.now() + 16 * 60000); service.tick(); const job = service.claim()!;
    expect(job).not.toBeNull(); service.commit(job, result(), "hermes-nebius", "nvidia/test");
    service.tick(); expect(store.all("SELECT * FROM ritual_runs")).toHaveLength(1);
  });
  it("keeps saved skills and queued work after reopening the database", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "togetherly-ritual-test-"));
    try {
      const filename = path.join(directory, "test.db");
      const id = save(); service.command(owner, { action: "ritual-run", id });
      await store.db.backup(filename);
      const reopened = new FamilyStore(filename);
      try {
        const resumed = new RitualService(reopened);
        expect(resumed.snapshot(owner).rituals[0].preferences).toEqual(defaultCallSkill);
        expect(resumed.claim()?.ritual_id).toBe(id);
      } finally { reopened.db.close(); }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
