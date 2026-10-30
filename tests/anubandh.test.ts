import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { FamilyStore, id } from "../lib/anubandh/store";
import { createDemo } from "../lib/anubandh/demo";
import { validateBrief } from "../lib/anubandh/ai";
import type { Member } from "../lib/anubandh/types";

let store: FamilyStore;
let owner: Member;
let relative: Member;
function addApproved(caption = "Meera planted jasmine on her balcony.") {
  const sourceId = store.addMemory(relative, {
    title: "The garden",
    caption,
    kind: "story",
    personIds: [],
    audience: ["*"],
  });
  store.reviewMemory(owner, sourceId, "approved", 1);
  return sourceId;
}
function consent() {
  store.settings(owner, {
    language: "en",
    timezone: "Asia/Kolkata",
    hour: 8,
    cloud: true,
  });
}
beforeEach(() => {
  store = new FamilyStore(":memory:");
  owner = store.createFamily({
    name: "Asha",
    familyName: "Test family",
    email: "asha@example.test",
    password: "long-example-password",
  });
  const invitation = store.invite(owner, {
    name: "Meera",
    relationship: "Daughter",
    view: true,
    contribute: true,
    schedule: true,
  });
  relative = store.join(
    invitation,
    "meera@example.test",
    "long-relative-password",
  );
});
afterEach(() => store.db.close());
describe("Anubandh family permissions", () => {
  it("requires explicit approval before retrieval", () => {
    const source = store.addMemory(relative, {
      title: "Hello",
      caption: "An update",
      kind: "story",
      personIds: [],
      audience: ["*"],
    });
    expect(store.memories(owner, true)).toHaveLength(0);
    expect(() => store.reviewMemory(relative, source, "approved", 1)).toThrow();
    store.reviewMemory(owner, source, "approved", 1);
    expect(store.memories(owner, true)).toHaveLength(1);
  });
  it("does not expose password hashes or other families", () => {
    const outsider = store.createFamily({
      name: "Other",
      familyName: "Other family",
      email: "other@example.test",
      password: "different-password",
    });
    const source = addApproved();
    expect(() => store.memory(outsider, source)).toThrow();
    expect(JSON.stringify(store.snapshot(owner))).not.toContain(
      "password_hash",
    );
    expect(() =>
      store.setAccess(outsider, relative.id, {
        active: false,
        view: false,
        contribute: false,
        schedule: false,
        expiresAt: null,
      }),
    ).toThrow();
  });
  it("makes invitations one-use and refuses privilege escalation", () => {
    const token = store.invite(owner, {
      name: "Friend",
      relationship: "Friend",
      view: false,
      contribute: true,
      schedule: false,
    });
    const friend = store.join(
      token,
      "friend@example.test",
      "friend-password-123",
    );
    expect(friend.can_view).toBe(0);
    expect(friend.role).toBe("relative");
    expect(() =>
      store.join(token, "second@example.test", "another-password"),
    ).toThrow();
    expect(() =>
      store.invite(relative, {
        name: "X",
        relationship: "X",
        view: true,
        contribute: true,
        schedule: true,
      }),
    ).toThrow();
  });
  it("revokes already-issued sessions", () => {
    const token = store.newSession(relative.id);
    expect(store.session(token)?.id).toBe(relative.id);
    store.setAccess(owner, relative.id, {
      active: false,
      view: false,
      contribute: false,
      schedule: false,
      expiresAt: null,
    });
    expect(store.session(token)).toBeNull();
    expect(() => store.memories(relative)).toThrow();
  });
  it("respects item-level visibility", () => {
    const privateId = store.addMemory(owner, {
      title: "Private",
      caption: "Personal details",
      kind: "story",
      personIds: [],
      audience: [],
    });
    store.reviewMemory(owner, privateId, "approved", 1);
    expect(store.memories(relative, true)).toHaveLength(0);
  });
  it("denies expired member access", () => {
    store.run(
      "UPDATE members SET expires_at=? WHERE id=?",
      Date.now() - 1000,
      relative.id,
    );
    expect(() => store.member(relative.id)).toThrow();
  });
  it("allows only the primary user to correct family profiles and tags", () => {
    const source = addApproved();
    const profile = {
      name: "Meera Rao",
      relationship: "Niece",
      about: "Lives nearby",
    };
    expect(() =>
      store.editPerson(relative, relative.person_id!, profile),
    ).toThrow();
    expect(() => store.editPerson(owner, id(), profile)).toThrow();
    store.editPerson(owner, relative.person_id!, profile);
    expect(store.member(relative.id).relationship).toBe("Niece");
    expect(store.people(owner)[0].name).toBe("Meera Rao");
    expect(() =>
      store.editMemory(
        owner,
        source,
        2,
        "Garden",
        "Known details",
        null,
        ["*"],
        [id()],
      ),
    ).toThrow();
    store.editMemory(
      owner,
      source,
      2,
      "Garden",
      "Known details",
      null,
      ["*"],
      [relative.person_id!],
    );
    expect(JSON.parse(store.memory(owner, source).person_ids)).toEqual([
      relative.person_id,
    ]);
  });
});
describe("Evidence-backed generation", () => {
  it("does not schedule a second briefing after a manual one, but refreshes corrected sources", () => {
    const source = addApproved();
    store.settings(owner, {
      language: "en",
      timezone: "UTC",
      hour: 0,
      cloud: true,
    });
    store.queue(owner, "briefing", null);
    const job = store.claimJob()!;
    const context = store.context(job);
    store.tick();
    const content = {
      items: [
        {
          sourceId: source,
          quote: context.sources[0].caption,
          text: context.sources[0].caption,
        },
      ],
      topics: [],
    };
    store.commitJob(job, context.fingerprint, content, "fixture", null);
    store.tick();
    store.tick();
    expect(store.all("SELECT * FROM jobs")).toHaveLength(1);
    store.editMemory(
      owner,
      source,
      2,
      "Corrected garden",
      "Meera planted roses.",
      null,
      ["*"],
    );
    store.tick();
    store.tick();
    expect(store.all("SELECT * FROM jobs")).toHaveLength(2);
  });
  it("invalidates prepared briefs and in-flight results after relationship correction", () => {
    addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const completed = store.claimJob()!;
    const firstContext = store.context(completed);
    store.commitJob(
      completed,
      firstContext.fingerprint,
      { items: [], topics: [] },
      "fixture",
      null,
    );
    store.queue(owner, "briefing", null);
    const running = store.claimJob()!;
    const context = store.context(running);
    store.editPerson(owner, relative.person_id!, {
      name: "Meera",
      relationship: "Niece",
      about: "",
    });
    expect(store.artifacts(owner)).toHaveLength(0);
    expect(() =>
      store.commitJob(
        running,
        context.fingerprint,
        { items: [], topics: [] },
        "fixture",
        null,
      ),
    ).toThrow();
  });
  it("blocks generation until cloud consent", () => {
    expect(() => store.queue(owner, "briefing", null)).toThrow();
  });
  it("deduplicates active jobs and commits exact source references", () => {
    const source = addApproved();
    consent();
    const jobId = store.queue(owner, "briefing", null);
    expect(store.queue(owner, "briefing", null)).toBe(jobId);
    const job = store.claimJob()!;
    const context = store.context(job);
    const content = validateBrief(
      {
        items: [
          {
            sourceId: source,
            quote: context.sources[0].caption,
            summary: "Meera planted jasmine on her balcony.",
            starters: ["Meera, what drew you to jasmine?", "Where did you put the jasmine on your balcony?"],
          },
        ],
      },
      context,
    );
    expect(content.items[0].text).toBe(context.sources[0].caption);
    store.commitJob(job, context.fingerprint, content, "fixture", null);
    expect(store.artifacts(owner)).toHaveLength(1);
  });
  it("rejects invented quotes and unrelated references", () => {
    addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const context = store.context(store.claimJob()!);
    expect(() =>
      validateBrief(
        {
          items: [
            {
              sourceId: context.sources[0].id,
              quote: "Meera got married.",
              summary: "Meera got married.",
              starters: ["How was the wedding?", "Who came to the wedding?"],
            },
          ],
        },
        context,
      ),
    ).toThrow();
    expect(() =>
      validateBrief(
        {
          items: [
            {
              sourceId: id(),
              quote: "An unknown family fact",
              summary: "An unknown family fact",
              starters: ["What happened next?", "How did that happen?"],
            },
          ],
        },
        context,
      ),
    ).toThrow();
  });
  it("rejects stale results after correction", () => {
    const source = addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const job = store.claimJob()!;
    const context = store.context(job);
    store.editMemory(
      owner,
      source,
      2,
      "Corrected",
      "Meera planted a rose.",
      null,
      ["*"],
    );
    expect(() =>
      store.commitJob(
        job,
        context.fingerprint,
        {
          items: [
            {
              sourceId: source,
              quote: context.sources[0].caption,
              text: context.sources[0].caption,
            },
          ],
          topics: [],
        },
        "fixture",
        null,
      ),
    ).toThrow();
    expect(store.artifacts(owner)).toHaveLength(0);
  });
  it("ignores results from cancelled and revoked jobs", () => {
    addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const job = store.claimJob()!;
    const context = store.context(job);
    store.settings(owner, {
      language: "en",
      timezone: "UTC",
      hour: 8,
      cloud: false,
    });
    store.commitJob(
      job,
      context.fingerprint,
      { items: [], topics: [] },
      "fixture",
      null,
    );
    expect(store.artifacts(owner)).toHaveLength(0);
  });
  it("invalidates derived briefs when the source is deleted", () => {
    const source = addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const job = store.claimJob()!;
    const context = store.context(job);
    store.commitJob(
      job,
      context.fingerprint,
      validateBrief(
        {
          items: [
            {
              sourceId: source,
              quote: context.sources[0].caption,
              summary: "Meera planted jasmine on her balcony.",
              starters: ["Meera, what drew you to jasmine?", "Where did you put the jasmine on your balcony?"],
            },
          ],
        },
        context,
      ),
      "fixture",
      null,
    );
    store.deleteMemory(owner, source);
    expect(store.artifacts(owner)).toHaveLength(0);
    expect(store.all("SELECT * FROM artifact_sources")).toHaveLength(0);
  });
  it("recovers expired worker leases without accepting old results", () => {
    addApproved();
    consent();
    store.queue(owner, "briefing", null);
    const first = store.claimJob()!;
    const context = store.context(first);
    store.run(
      "UPDATE jobs SET lease_until=? WHERE id=?",
      Date.now() - 1000,
      first.id,
    );
    const second = store.claimJob()!;
    expect(second.id).toBe(first.id);
    expect(second.leaseToken).not.toBe(first.leaseToken);
    store.commitJob(
      first,
      context.fingerprint,
      { items: [], topics: [] },
      "fixture",
      null,
    );
    expect(store.artifacts(owner)).toHaveLength(0);
  });
  it("expires sources and removes them from future retrieval", () => {
    const source = addApproved();
    store.run(
      "UPDATE memories SET expires_at=? WHERE id=?",
      Date.now() - 1000,
      source,
    );
    store.tick();
    expect(store.memories(owner)).toHaveLength(0);
  });
});
describe("Approved replies and demo", () => {
  it("requires approval and delivers exactly once", () => {
    const message = store.createMessage(
      owner,
      relative.id,
      "Hello Meera",
      null,
    );
    expect(store.messages(relative)).toHaveLength(0);
    expect(() => store.sendMessage(relative, message, 1)).toThrow();
    expect(() => store.sendMessage(owner, message, 2)).toThrow();
    store.sendMessage(owner, message, 1);
    store.sendMessage(owner, message, 1);
    expect(store.messages(relative)).toHaveLength(1);
    expect(store.messages(relative)[0].status).toBe("delivered");
    store.openMessage(relative, message);
    expect(store.messages(owner)[0].status).toBe("opened");
    expect(
      store.all("SELECT * FROM receipts WHERE kind='reply_delivered'"),
    ).toHaveLength(1);
  });
  it("does not deliver to a revoked recipient", () => {
    const message = store.createMessage(owner, relative.id, "Hello", null);
    store.setAccess(owner, relative.id, {
      active: false,
      view: false,
      contribute: false,
      schedule: false,
      expiresAt: null,
    });
    expect(() => store.sendMessage(owner, message, 1)).toThrow();
  });
  it("creates useful isolated sample families without enabling cloud consent", () => {
    const demo = createDemo(store);
    const another = createDemo(store);
    expect(store.family(demo.family_id).cloud_consent).toBe(0);
    expect(store.memories(demo, true)).toHaveLength(3);
    expect(store.members(demo)).toHaveLength(4);
    expect(store.memories(another)[0].family_id).not.toBe(demo.family_id);
  });
});
