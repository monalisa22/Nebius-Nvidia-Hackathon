import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyStore } from "../lib/anubandh/store";
import { generateBrief, validateBrief } from "../lib/anubandh/ai";
import type { Member } from "../lib/anubandh/types";
import { CompanionService } from "../lib/togetherly/service";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../lib/ai/token-factory", () => ({ createTokenFactoryClient: () => ({ chat: { completions: { create } } }) }));
let store: FamilyStore;
let owner: Member;
let daughter: Member;
let brother: Member;
let sourceId: string;
const caption = "Today, I finally played my first full song from start to finish. It wasn't perfect, but hearing a real melody come from the guitar felt amazing.";
const summary = "Ruhi played her first full song on guitar.";
const starters = ["Ruhi, which song did you play?", "What was it like hearing the whole melody come together?", "Which part of the song did you enjoy playing most?"];
function context(viewer = owner, kind: "briefing" | "call" = "briefing") {
  const call = kind === "call" ? store.scheduleCall(owner, daughter.person_id!, Date.now() + 3600000, "") : null;
  store.queue(viewer, kind, call);
  const job = store.claimJob()!;
  return { job, context: store.context(job) };
}
function response(items = [{ sourceId, quote: caption, summary, starters }]) {
  return { choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ type: "function", function: { name: "report_brief", arguments: JSON.stringify({ items }) } }] } }] };
}
beforeEach(() => {
  store = new FamilyStore(":memory:");
  owner = store.createFamily({ name: "Monalisa", familyName: "Synthetic family", email: "parent@example.test", password: "synthetic-password-123" });
  const join = (name: string, relationship: string) => store.join(store.invite(owner, { name, relationship, view: true, contribute: true, schedule: true }), `${name}@example.test`, "synthetic-password-123");
  daughter = join("Ruhi", "Daughter");
  brother = join("Rohan", "Son");
  sourceId = store.addMemory(daughter, { title: "My first full song", caption, kind: "story", personIds: [daughter.person_id!], audience: ["*"] });
  store.reviewMemory(owner, sourceId, "approved", 1);
  store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: true });
  vi.stubEnv("AI_PROVIDER", "token-factory");
  vi.stubEnv("NEBIUS_API_KEY", "synthetic-test-key");
  vi.stubEnv("NEBIUS_MODEL", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
  create.mockReset();
});
afterEach(() => { store.db.close(); vi.unstubAllEnvs(); });

describe("short personal briefings with original evidence", () => {
  it("keeps the source quote but displays a short caption and generated starters", () => {
    const { job, context: input } = context(owner, "call");
    const content = validateBrief({ items: [{ sourceId, quote: caption, summary, starters }] }, input);
    expect(content).toMatchObject({ version: 2, items: [{ quote: caption, text: summary, starters }], topics: starters });
    store.commitJob(job, input.fingerprint, content, "token-factory", "nvidia/test");
    const companion = new CompanionService(store).callContext(owner, daughter.person_id!);
    expect(companion.prompts.map(p => p.text)).toEqual(starters);
    expect(companion.prompts.every(p => p.sourceId === sourceId)).toBe(true);
    expect(new CompanionService(store).callContext(brother, daughter.person_id!).prompts).toEqual([]);
    store.deleteMemory(owner, sourceId);
    expect(new CompanionService(store).callContext(owner, daughter.person_id!).prompts).toEqual([]);
  });
  it("sends viewer, real author, and viewer-relative relationships to Nemotron", async () => {
    create.mockResolvedValue(response());
    const { context: input } = context(brother, "call");
    expect((await generateBrief(input)).content.items[0].text).toBe(summary);
    const request = create.mock.calls[0][0];
    const data = JSON.parse(request.messages[1].content);
    expect(data.viewer.name).toBe("Rohan");
    expect(data.callPerson).toEqual({ name: "Ruhi", relationshipToViewer: "Your sister" });
    expect(data.sources[0].contributedBy).toEqual({ name: "Ruhi", isViewer: false });
    expect(data.sources[0].people).toEqual([{ name: "Ruhi", relationshipToViewer: "Your sister" }]);
    expect(request.messages[0].content).toContain("NOT a tagged person's name");
    expect(request.tools).toHaveLength(1);
    expect(request.tool_choice.function.name).toBe("report_brief");
    expect(JSON.stringify(data)).not.toContain("password");
  });
  it("does not substitute a tagged person for the author", async () => {
    store.editMemory(owner, sourceId, 2, "Guitar update", caption, null, ["*"], [brother.person_id!]);
    create.mockResolvedValue(response());
    await generateBrief(context().context);
    const data = JSON.parse(create.mock.calls[0][0].messages[1].content);
    expect(data.sources[0].contributedBy.name).toBe("Ruhi");
    expect(data.sources[0].people[0].name).toBe("Rohan");
  });
  it.each([
    { quote: "An invented memory" },
    { sourceId: "an-inaccessible-source" },
    { summary: "x".repeat(221) },
    { summary: "A ".repeat(33).trim() },
    { starters: [] },
    { starters: [starters[0], starters[0]] },
  ])("rejects invalid output: %j", (override) => {
    expect(() => validateBrief({ items: [{ sourceId, quote: caption, summary, starters, ...override }] }, context().context)).toThrow();
  });
  it("never uses pending or private sources in a relative's brief", () => {
    const secret = store.addMemory(owner, { title: "Private", caption: "Private family detail", kind: "story", personIds: [], audience: [] });
    store.reviewMemory(owner, secret, "approved", 1);
    store.addMemory(daughter, { title: "Pending", caption: "Not approved yet", kind: "story", personIds: [], audience: ["*"] });
    expect(context(brother).context.sources.map(s => s.id)).toEqual([sourceId]);
  });
  it("keeps offline fixtures clearly separate from AI personalization", async () => {
    vi.stubEnv("AI_PROVIDER", "fixture");
    const result = await generateBrief(context().context);
    expect(result.provider).toBe("fixture");
    expect(result.content.items[0].text).toBe(caption);
    expect(result.content.topics).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects incomplete provider output", async () => {
    create.mockResolvedValue({ ...response(), choices: [{ ...response().choices[0], finish_reason: "length" }] });
    await expect(generateBrief(context().context)).rejects.toThrow("response limit");
  });
});
