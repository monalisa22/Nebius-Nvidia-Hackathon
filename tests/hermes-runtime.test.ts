import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { FamilyStore } from "../lib/anubandh/store";
import { RitualService } from "../lib/togetherly/ritual-service";
import { prepareWithHermes } from "../lib/togetherly/hermes";
import type { RitualRun } from "../lib/togetherly/ritual-contracts";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdtemp: vi.fn(async () => "/tmp/mock-hermes-private"), rm: vi.fn(async () => {}) }));
vi.mock("../lib/togetherly/hermes-status", () => ({ hermesStatus: () => ({ available: true }), hermesPython: () => "/approved/python" }));
let store: FamilyStore, service: RitualService, run: RitualRun;
let child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; kill: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.stubEnv("NEBIUS_API_KEY", "synthetic-key"); vi.stubEnv("NEBIUS_MODEL", "nvidia/test"); vi.stubEnv("AI_PROVIDER", "token-factory");
  store = new FamilyStore(":memory:"); service = new RitualService(store);
  const owner = store.createFamily({ name: "Asha", familyName: "Synthetic", email: "owner@example.test", password: "long-test-password" });
  const relative = store.join(store.invite(owner, { name: "Meera", relationship: "Daughter", view: true, contribute: true, schedule: true }), "meera@example.test", "long-test-password");
  const sourceId = store.addMemory(relative, { title: "Music", caption: "I played guitar.", kind: "story", personIds: [relative.person_id!], audience: ["*"] });
  store.reviewMemory(owner, sourceId, "approved", 1);
  store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true });
  const id = service.command(owner, { action: "ritual-save", skill: "call", engine: "hermes", recipientId: relative.id, sourceIds: [sourceId], cadence: "manual", allowAction: false, expiresAt: null }).id as string;
  service.command(owner, { action: "ritual-learn", id, instruction: "One question, please." }); run = service.claim()!;
  child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }) });
  vi.mocked(spawn).mockReturnValue(child as never);
});
afterEach(() => { store.db.close(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks(); });
function output(value: unknown) { child.stdout.write(JSON.stringify(value) + "\n"); }

it("uses an isolated environment, cleans up, and returns only host-validated proposals", async () => {
  let writes = 0;
  child.stdin.on("data", () => { const step = writes++; queueMicrotask(() => {
    if (step === 0) output({ type: "tool", name: "load_call_skill", args: {} });
    if (step === 1) output({ type: "tool", name: "propose_skill", args: { maxMoments: 2, questionCount: 1, focus: "mixed", tone: "simple" } });
    if (step === 2) { output({ type: "done", apiCalls: 3 }); child.emit("close", 0); }
  }); });
  const result = await prepareWithHermes(service, run);
  expect(result.content).toMatchObject({ maxMoments: 2, questionCount: 1 });
  expect(result.receipt.map(r => r.tool)).toEqual(["load_call_skill", "propose_skill"]);
  const options = vi.mocked(spawn).mock.calls[0][2]!;
  expect(options).toMatchObject({ cwd: "/tmp/mock-hermes-private", env: { HOME: "/tmp/mock-hermes-private", HERMES_HOME: "/tmp/mock-hermes-private" } });
  expect(options.env).not.toHaveProperty("DATABASE_PATH");
  expect(options.env).not.toHaveProperty("ANUBANDH_DATABASE_PATH");
  expect(rm).toHaveBeenCalledWith("/tmp/mock-hermes-private", { recursive: true, force: true });
});
it("terminates an unauthorized tool request without executing or retaining it", async () => {
  child.stdin.once("data", () => queueMicrotask(() => output({ type: "tool", name: "terminal", args: { command: "not allowed" } })));
  await expect(prepareWithHermes(service, run)).rejects.toThrow(/not permitted/);
  expect(child.kill).toHaveBeenCalled(); expect(rm).toHaveBeenCalled();
});
it("rejects malformed output instead of pretending a direct model fallback used Hermes", async () => {
  child.stdin.once("data", () => queueMicrotask(() => child.stdout.write("not json\n")));
  await expect(prepareWithHermes(service, run)).rejects.toThrow(/invalid response/);
  expect(child.kill).toHaveBeenCalled(); expect(rm).toHaveBeenCalled();
});
it("kills a stuck subprocess at the deadline and removes its temporary profile", async () => {
  vi.useFakeTimers();
  const result = expect(prepareWithHermes(service, run)).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(240001);
  await result; expect(child.kill).toHaveBeenCalled(); expect(rm).toHaveBeenCalled();
});
it("terminates a running subprocess when the user cancels its job", async () => {
  vi.useFakeTimers();
  child.stdin.once("data", () => {
    store.run("UPDATE ritual_runs SET status='dismissed',lease_token=NULL,lease_until=NULL WHERE id=?", run.id);
  });
  const result = expect(prepareWithHermes(service, run)).rejects.toThrow(/permissions or memories changed/);
  await vi.advanceTimersByTimeAsync(1001);
  await result; expect(child.kill).toHaveBeenCalled(); expect(rm).toHaveBeenCalled();
});
