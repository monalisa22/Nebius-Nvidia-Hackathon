import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyStore } from "../lib/anubandh/store";
import type { Member } from "../lib/anubandh/types";
import { CompanionService } from "../lib/togetherly/service";

const DAY = 86400000;
let store: FamilyStore;
let service: CompanionService;
let owner: Member;
let daughter: Member;
let son: Member;
function invite(name: string) {
  return store.join(store.invite(owner, { name, relationship: "Family", view: true, contribute: true, schedule: true }), `${name}@example.test`, "a-long-test-password");
}
function approved(audience = ["*"]) {
  const sourceId = store.addMemory(daughter, { title: "Meera's music", caption: "Meera loves playing the guitar. Meera says she feels excited about her concert.", kind: "story", personIds: [daughter.person_id!], audience });
  store.reviewMemory(owner, sourceId, "approved", 1);
  return store.memory(owner, sourceId);
}
function settings(member = owner, overrides = {}) {
  return service.command(member, { action: "preferences", reminders: true, quietDays: 21,
    checkinEnabled: false, trustedId: null, checkinDays: 3, ...overrides });
}
function consent() { store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true }); }
function revoke(member = daughter) {
  store.setAccess(owner, member.id, { active: false, view: false, contribute: false, schedule: false, expiresAt: null });
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  store = new FamilyStore(":memory:");
  service = new CompanionService(store);
  owner = store.createFamily({ name: "Asha", familyName: "Test family", email: "owner@example.test", password: "a-long-owner-password" });
  daughter = invite("Meera");
  son = invite("Rohan");
});
afterEach(() => { store.db.close(); vi.useRealTimers(); });

describe("source-grounded companion memory", () => {
  it("requires approval and exact quotes from an already-tagged person", () => {
    const memory = approved();
    const fact = { personId: daughter.person_id, category: "interest", quote: "Meera loves playing the guitar." };
    expect(() => service.command(daughter, { action: "fact-propose", sourceId: memory.id, fact: { ...fact, quote: "Meera won a concert." } })).toThrow();
    expect(() => service.command(daughter, { action: "fact-propose", sourceId: memory.id, fact: { ...fact, personId: son.person_id } })).toThrow();
    const result = service.command(daughter, { action: "fact-propose", sourceId: memory.id, fact });
    expect(service.snapshot(son).facts).toHaveLength(0);
    expect(() => service.command(daughter, { action: "fact-review", id: result.id, decision: "approved" })).toThrow();
    service.command(owner, { action: "fact-review", id: result.id, decision: "approved" });
    expect(service.callContext(son, daughter.person_id!).facts).toHaveLength(1);
    store.editMemory(owner, memory.id, memory.revision, memory.title, "Meera enjoys painting.", null, ["*"], [daughter.person_id!]);
    expect(service.snapshot(owner).facts).toHaveLength(0);
  });
  it("does not expose private, expired, or other-family sources", () => {
    const memory = approved([]);
    service.command(owner, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2014-10-25", place: "Pune", legacy: true });
    expect(service.snapshot(son).dailyMoment).toBeNull();
    expect(service.snapshot(son).memoryContext).toHaveLength(0);
    const stranger = store.createFamily({ name: "Other", familyName: "Elsewhere", email: "other@example.test", password: "other-long-password" });
    expect(() => service.command(stranger, { action: "fact-propose", sourceId: memory.id, fact: { personId: daughter.person_id, category: "interest", quote: "Meera loves playing the guitar." } })).toThrow();
    store.run("UPDATE memories SET expires_at=? WHERE id=?", Date.now() - 1, memory.id);
    expect(service.snapshot(owner).dailyMoment).toBeNull();
    expect(() => service.callContext(stranger, daughter.person_id!)).toThrow();
  });
  it("uses actual event dates, not upload dates, for anniversaries", () => {
    const memory = approved();
    expect(service.dailyMoment(owner)?.kind).toBe("revisit");
    expect(() => service.command(owner, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2025-02-29", place: "", legacy: true })).toThrow();
    expect(() => service.command(owner, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2030-10-25", place: "", legacy: true })).toThrow();
    service.command(owner, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2014-10-25", place: "Pune", legacy: true });
    expect(service.dailyMoment(owner)).toMatchObject({ kind: "anniversary", yearsAgo: 12 });
    expect(service.dailyMoment(owner)).toEqual(service.dailyMoment(owner));
    expect(() => service.command(daughter, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: null, place: "", legacy: false })).toThrow();
  });
  it("uses the family timezone and keeps leap-day anniversaries on leap day", () => {
    const memory = approved();
    service.command(owner, { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2024-02-29", place: "", legacy: true });
    vi.setSystemTime(new Date("2028-02-28T20:00:00Z"));
    expect(service.dailyMoment(owner)).toMatchObject({ day: "2028-02-29", kind: "anniversary", yearsAgo: 4 });
    vi.setSystemTime(new Date("2029-02-28T12:00:00Z"));
    expect(service.dailyMoment(owner)?.kind).toBe("revisit");
  });
  it("rejects stale edits to a memory's confirmed date and place", () => {
    const memory = approved();
    const command = { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2014-10-25", place: "Pune", legacy: true };
    service.command(owner, command);
    expect(() => service.command(owner, { ...command, place: "Delhi" })).toThrow();
    expect(service.snapshot(owner).memoryContext[0].place).toBe("Pune");
  });
  it("keeps a walk's missing current source explicit instead of silently replacing it", () => {
    const first = approved(); const second = approved();
    const walk = service.command(son, { action: "walk-create", title: "Family music", sourceIds: [first.id, second.id] });
    store.deleteMemory(owner, first.id);
    expect(service.snapshot(son).walks[0]).toMatchObject({ currentSourceId: null, position: 0 });
    expect(() => service.command(son, { action: "walk-progress", id: walk.id, position: 0, status: "active" })).toThrow();
    service.command(son, { action: "walk-progress", id: walk.id, position: 1, status: "paused" });
    expect(service.snapshot(son).walks[0].currentSourceId).toBe(second.id);
    expect(() => service.command(daughter, { action: "walk-progress", id: walk.id, position: 1, status: "active" })).toThrow();
  });
  it("refreshes live companion context after a source is removed", () => {
    const memory = approved();
    const session = service.command(son, { action: "session-start", personId: daughter.person_id });
    expect(service.callContext(son, daughter.person_id!).memories).toHaveLength(1);
    store.deleteMemory(owner, memory.id);
    expect(service.callContext(son, daughter.person_id!).memories).toHaveLength(0);
    service.command(daughter, { action: "session-end", id: session.id });
    expect(service.snapshot(son).sessions[0].ended_at).toBeNull();
    service.command(son, { action: "session-end", id: session.id });
    expect(service.snapshot(son).sessions[0].ended_at).toBe(Date.now());
    expect(service.connections(son).every(c => c.lastConnectedAt === null)).toBe(true);
  });
});

describe("AI lifecycle", () => {
  it("deduplicates extraction, keeps results pending, and rejects ungrounded output atomically", () => {
    const memory = approved(); consent();
    const request = { action: "extract", sourceId: memory.id };
    expect(service.command(owner, request).id).toBe(service.command(owner, request).id);
    const job = service.claimExtraction()!;
    const context = service.extractionContext(job);
    const fact = { personId: daughter.person_id, category: "interest", quote: "Meera loves playing the guitar." };
    expect(() => service.commitExtraction(job, context.fingerprint, { facts: [fact, { ...fact, quote: "Made-up fact" }] })).toThrow();
    expect(service.facts(owner)).toHaveLength(0);
    service.commitExtraction(job, context.fingerprint, { facts: [fact] }, "token-factory", "test-model");
    expect(service.facts(owner)[0].status).toBe("pending");
    expect(service.snapshot(son).facts).toHaveLength(0);
    expect(service.snapshot(owner).jobs[0]).toMatchObject({ status: "completed", provider: "token-factory", model: "test-model" });
    service.commitExtraction(job, context.fingerprint, { facts: [fact] });
    expect(service.facts(owner)).toHaveLength(1);
  });
  it("rejects stale context and cancelled jobs", () => {
    const memory = approved(); consent();
    service.command(owner, { action: "extract", sourceId: memory.id });
    const job = service.claimExtraction()!;
    const context = service.extractionContext(job);
    store.editPerson(owner, daughter.person_id!, { name: "Meera Rao", relationship: "Daughter", about: "" });
    expect(() => service.commitExtraction(job, context.fingerprint, { facts: [] })).toThrow();
    service.command(owner, { action: "extraction-cancel", id: job.id });
    service.commitExtraction(job, context.fingerprint, { facts: [] });
    expect(service.snapshot(owner).jobs[0].status).toBe("cancelled");
  });
  it("requires both explicit automatic-suggestion opt-in and cloud consent", () => {
    approved(); service.tick();
    expect(service.snapshot(owner).jobs).toHaveLength(0);
    expect(() => settings(owner, { autoInsights: true })).toThrow();
    consent(); settings(owner, { autoInsights: true }); service.tick(); service.tick();
    expect(service.snapshot(owner).jobs).toHaveLength(1);
    settings(owner, { autoInsights: false });
    expect(service.snapshot(owner).jobs[0].status).toBe("cancelled");
  });
  it("recovers interrupted leases and limits retries", () => {
    const memory = approved(); consent();
    service.command(owner, { action: "extract", sourceId: memory.id });
    const first = service.claimExtraction()!;
    vi.setSystemTime(Date.now() + 151000);
    const second = service.claimExtraction()!;
    expect(second.lease_token).not.toBe(first.lease_token);
    service.commitExtraction(first, service.extractionContext(first).fingerprint, { facts: [] });
    expect(service.snapshot(owner).jobs[0].status).toBe("running");
    service.failExtraction(second, true);
    vi.setSystemTime(Date.now() + 30000);
    const third = service.claimExtraction()!;
    service.failExtraction(third, true);
    expect(service.snapshot(owner).jobs[0].status).toBe("failed");
  });
});

describe("future capsule delivery", () => {
  it("keeps a capsule private until its approved time and delivers exactly once", () => {
    const mediaId = store.saveMedia(owner, "audio/webm", 100);
    const created = service.command(owner, { action: "capsule-create", recipientId: daughter.id, title: "For your birthday", text: "A future hello", mediaId, deliverAt: Date.now() + DAY });
    const capsule = service.snapshot(owner).capsules[0];
    expect(service.snapshot(daughter).capsules).toHaveLength(0);
    expect(store.messages(daughter)).toHaveLength(0);
    expect(() => store.media(daughter, mediaId)).toThrow();
    expect(() => store.sendMessage(owner, capsule.message_id, 1)).toThrow();
    expect(() => service.command(daughter, { action: "capsule-approve", id: created.id, revision: 1 })).toThrow();
    service.command(owner, { action: "capsule-approve", id: created.id, revision: 1 });
    service.tick(); expect(store.messages(daughter)).toHaveLength(0);
    vi.setSystemTime(Date.now() + DAY);
    service.tick(); service.tick();
    expect(store.messages(daughter)).toHaveLength(1);
    expect(store.media(daughter, mediaId).id).toBe(mediaId);
    expect(service.snapshot(owner).capsules[0].status).toBe("delivered");
  });
  it("requires renewed approval after rescheduling and honors cancellation", () => {
    const created = service.command(owner, { action: "capsule-create", recipientId: daughter.id, title: "Hello", text: "For later", deliverAt: Date.now() + DAY });
    service.command(owner, { action: "capsule-approve", id: created.id, revision: 1 });
    service.command(owner, { action: "capsule-reschedule", id: created.id, revision: 2, deliverAt: Date.now() + DAY * 2 });
    expect(service.snapshot(owner).capsules[0].status).toBe("draft");
    expect(() => service.command(owner, { action: "capsule-approve", id: created.id, revision: 2 })).toThrow();
    service.command(owner, { action: "capsule-approve", id: created.id, revision: 3 });
    service.command(owner, { action: "capsule-cancel", id: created.id, revision: 4 });
    vi.setSystemTime(Date.now() + DAY * 3); service.tick();
    expect(store.messages(daughter)).toHaveLength(0);
  });
  it("blocks delivery when recipient access has ended", () => {
    const created = service.command(owner, { action: "capsule-create", recipientId: daughter.id, title: "Hello", text: "For later", deliverAt: Date.now() + DAY });
    service.command(owner, { action: "capsule-approve", id: created.id, revision: 1 });
    revoke(); vi.setSystemTime(Date.now() + DAY); service.tick();
    expect(service.snapshot(owner).capsules[0].status).toBe("failed");
    expect(store.one<{ status: string }>("SELECT status FROM messages")!.status).toBe("draft");
  });
  it("rechecks a reschedule between the due-job scan and the delivery transaction", () => {
    const created = service.command(owner, { action: "capsule-create", recipientId: daughter.id, title: "Hello", text: "For later", deliverAt: Date.now() + DAY });
    service.command(owner, { action: "capsule-approve", id: created.id, revision: 1 });
    vi.setSystemTime(Date.now() + DAY);
    const original = store.all.bind(store);
    const scan = vi.spyOn(store, "all").mockImplementation((sql, ...params) => {
      const rows = original(sql, ...params);
      if (sql.startsWith("SELECT * FROM memory_capsules WHERE status='scheduled'")) {
        service.command(owner, { action: "capsule-reschedule", id: created.id, revision: 2, deliverAt: Date.now() + DAY });
        service.command(owner, { action: "capsule-approve", id: created.id, revision: 3 });
      }
      return rows;
    });
    service.tick(); scan.mockRestore();
    expect(service.snapshot(owner).capsules[0].status).toBe("scheduled");
    expect(store.messages(daughter)).toHaveLength(0);
  });
});

describe("connection, family links, and shared activities", () => {
  it("does not count drafts, app reads, or other people's private interactions", () => {
    settings();
    store.createMessage(owner, daughter.id, "Private draft", null);
    const privateMessage = store.createMessage(daughter, son.id, "Between siblings", null);
    store.sendMessage(daughter, privateMessage, 1);
    expect(service.connections(owner).every(c => c.lastConnectedAt === null)).toBe(true);
    const incoming = store.createMessage(daughter, owner.id, "Hello mum", null);
    store.sendMessage(daughter, incoming, 1);
    expect(service.connections(owner).find(c => c.memberId === daughter.id)).toMatchObject({ awaitingReply: true, reminder: "Meera shared a message. Would you like to reply?" });
    const outgoing = store.createMessage(owner, daughter.id, "Hello!", null);
    store.sendMessage(owner, outgoing, 1);
    expect(service.connections(owner).find(c => c.memberId === daughter.id)?.awaitingReply).toBe(false);
  });
  it("requires activity acceptance and relevant approved evidence", () => {
    const memory = approved();
    const activity = service.command(owner, { action: "activity-create", assigneeId: daughter.id, personId: daughter.person_id, promptKey: "song" });
    expect(service.snapshot(son).activities).toHaveLength(0);
    expect(() => service.command(owner, { action: "activity-update", id: activity.id, operation: "accept" })).toThrow();
    expect(() => service.command(daughter, { action: "activity-update", id: activity.id, operation: "complete", evidenceId: memory.id })).toThrow();
    service.command(daughter, { action: "activity-update", id: activity.id, operation: "accept" });
    service.command(daughter, { action: "activity-update", id: activity.id, operation: "complete", evidenceId: memory.id });
    expect(service.snapshot(daughter).milestones.memoriesMadeTogether).toBe(1);
    store.deleteMemory(owner, memory.id);
    expect(service.snapshot(daughter).milestones.memoriesMadeTogether).toBe(0);
  });
  it("prevents family-tree cycles, duplicates, and unauthorized editing", () => {
    const parent = { action: "link-add", fromId: daughter.person_id, toId: son.person_id, kind: "parent" };
    expect(() => service.command(daughter, parent)).toThrow();
    expect(service.command(owner, parent).id).toBe(service.command(owner, parent).id);
    expect(() => service.command(owner, { ...parent, fromId: son.person_id, toId: daughter.person_id })).toThrow();
    expect(service.snapshot(owner).links).toHaveLength(1);
  });
  it("rejects stale authenticated member objects after revocation", () => {
    revoke();
    expect(() => service.snapshot(daughter)).toThrow();
    expect(() => service.command(daughter, { action: "check-in" })).toThrow();
    expect(() => service.connections(daughter)).toThrow();
  });
});

describe("consented check-ins", () => {
  it("is opt-in, private to the trusted contact, deduplicated, and withdrawn immediately", () => {
    service.tick(); expect(service.snapshot(son).notices).toHaveLength(0);
    settings(daughter, { checkinEnabled: true, trustedId: son.id, checkinDays: 3 });
    vi.setSystemTime(Date.now() + DAY * 3);
    service.tick(); service.tick();
    expect(service.snapshot(son).notices).toHaveLength(1);
    expect(service.snapshot(owner).notices).toHaveLength(0);
    const baseline = service.preferences(daughter).checked_in_at;
    service.snapshot(daughter);
    expect(service.preferences(daughter).checked_in_at).toBe(baseline);
    settings(daughter, { checkinEnabled: false });
    expect(service.snapshot(son).notices).toHaveLength(0);
  });
  it("resets notices with an explicit check-in and rejects unrelated contacts", () => {
    settings(daughter, { checkinEnabled: true, trustedId: son.id, checkinDays: 1 });
    vi.setSystemTime(Date.now() + DAY); service.tick();
    expect(service.snapshot(son).notices).toHaveLength(1);
    service.command(daughter, { action: "check-in" }); service.tick();
    expect(service.snapshot(son).notices).toHaveLength(0);
    const outsider = store.createFamily({ name: "Other", familyName: "Other", email: "other@example.test", password: "another-long-password" });
    expect(() => settings(daughter, { checkinEnabled: true, trustedId: outsider.id })).toThrow();
    revoke(son); vi.setSystemTime(Date.now() + DAY); service.tick();
    expect(store.all("SELECT * FROM companion_notices")).toHaveLength(0);
  });
});
