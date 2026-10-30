import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FamilyStore } from "../lib/anubandh/store";
import type { Member } from "../lib/anubandh/types";
import { CompanionService } from "../lib/togetherly/service";

let store: FamilyStore;
let owner: Member;
let sister: Member;
let brother: Member;
function join(name: string, relationship: string) {
  return store.join(store.invite(owner, { name, relationship, view: true, contribute: true, schedule: true }),
    `${name.toLowerCase()}@example.test`, "synthetic-password-123");
}
function label(viewer: Member, personId: string) {
  return store.snapshot(viewer).people.find(p => p.id === personId)?.relationship_label;
}
beforeEach(() => {
  store = new FamilyStore(":memory:");
  owner = store.createFamily({ name: "Monalisa", familyName: "Synthetic family", email: "parent@example.test", password: "synthetic-password-123" });
  sister = join("Ruhi", "Daughter");
  brother = join("Rohan", "Son");
});
afterEach(() => store.db.close());

describe("relationships from the signed-in person's perspective", () => {
  it("shows daughter to the parent, sister to her brother, and You to herself", () => {
    expect(label(owner, sister.person_id!)).toBe("Your daughter");
    expect(label(brother, sister.person_id!)).toBe("Your sister");
    expect(label(sister, brother.person_id!)).toBe("Your brother");
    expect(label(sister, sister.person_id!)).toBe("You");
    expect(store.snapshot(brother).members.find(m => m.id === owner.id)?.relationship_label).toBe("Your parent");
    expect(new CompanionService(store).connections(brother).find(c => c.memberId === sister.id)?.relationship).toBe("Your sister");
    expect(store.member(sister.id).relationship).toBe("Daughter");
  });
  it("normalizes case and uses gender-neutral labels when gender is not explicit", () => {
    const child = join("Alex", " child ");
    expect(label(brother, child.person_id!)).toBe("Your sibling");
    store.editPerson(owner, sister.person_id!, { name: "Ruhi", relationship: " DAUGHTER ", about: "" });
    expect(label(brother, sister.person_id!)).toBe("Your sister");
  });
  it("does not assume which child's child a grandchild is", () => {
    const grandchild = join("Aarav", "Grandson");
    expect(label(brother, grandchild.person_id!)).toBe("Monalisa's grandson");
    expect(label(owner, grandchild.person_id!)).toBe("Your grandson");
    const service = new CompanionService(store);
    const link = service.command(owner, { action: "link-add", fromId: sister.person_id, toId: grandchild.person_id, kind: "parent" });
    expect(label(sister, grandchild.person_id!)).toBe("Your son");
    service.command(owner, { action: "link-delete", id: link.id });
    expect(label(sister, grandchild.person_id!)).toBe("Monalisa's grandson");
  });
  it("uses explicit links instead of guessing from names or roles", () => {
    const friend = join("Sam", "Friend");
    expect(label(brother, friend.person_id!)).toBe("Monalisa's friend");
    const service = new CompanionService(store);
    service.command(owner, { action: "link-add", fromId: brother.person_id, toId: friend.person_id, kind: "sibling" });
    expect(label(brother, friend.person_id!)).toBe("Your sibling");
  });
  it("preserves uncertainty for conflicting family connections", () => {
    const service = new CompanionService(store);
    service.command(owner, { action: "link-add", fromId: brother.person_id, toId: sister.person_id, kind: "sibling" });
    service.command(owner, { action: "link-add", fromId: brother.person_id, toId: sister.person_id, kind: "partner" });
    expect(label(brother, sister.person_id!)).toBe("Monalisa's daughter");
  });
  it("invalidates briefings and in-flight generation when links change", () => {
    store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: true });
    store.queue(owner, "briefing", null);
    const completed = store.claimJob()!;
    store.commitJob(completed, store.context(completed).fingerprint, { items: [], topics: [] }, "fixture", null);
    store.queue(owner, "briefing", null);
    const running = store.claimJob()!;
    const before = store.context(running);
    new CompanionService(store).command(owner, { action: "link-add", fromId: brother.person_id, toId: sister.person_id, kind: "sibling" });
    expect(store.artifacts(owner)).toHaveLength(0);
    expect(() => store.commitJob(running, before.fingerprint, { items: [], topics: [] }, "fixture", null)).toThrow("changed");
  });
});
