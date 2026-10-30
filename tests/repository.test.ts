import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FixturePersonalAiProvider } from "../lib/ai/fixture-provider";

const testDatabasePath = path.join(
  "/tmp",
  `openloop-repository-${process.pid}-${Date.now()}.db`,
);

describe("Project Mercury repository workflow", () => {
  let repository: typeof import("../lib/repository");
  let sqlite: typeof import("../lib/db").sqlite;

  beforeAll(async () => {
    process.env.DATABASE_PATH = testDatabasePath;
    process.env.AI_PROVIDER = "fixture";
    repository = await import("../lib/repository");
    ({ sqlite } = await import("../lib/db"));
  });

  afterAll(() => {
    sqlite?.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      fs.rmSync(`${testDatabasePath}${suffix}`, { force: true });
    }
  });

  it("moves from candidate review through an approved saved draft", async () => {
    let dashboard = await repository.getDashboardData();
    expect(dashboard.candidates).toHaveLength(1);

    repository.approveCandidate({
      candidateId: dashboard.candidates[0].id,
    });
    dashboard = await repository.getDashboardData();
    expect(dashboard.commitments[0].status).toBe("waiting");

    await repository.ingestEvidence({
      title: "Internal review",
      content: "Maya: Looks good internally, but client approval is pending.",
      project: "Project Mercury",
    });
    dashboard = await repository.getDashboardData();
    expect(dashboard.commitments[0].status).toBe("waiting");
    expect(dashboard.evaluations[0].outcome).toBe("unsatisfied");

    await repository.ingestEvidence({
      title: "Final approval",
      content:
        "Maya: The final Project Mercury scope is approved. Please proceed with the proposal.",
      project: "Project Mercury",
    });
    dashboard = await repository.getDashboardData();
    expect(dashboard.commitments[0].status).toBe("ready");

    await repository.prepareDraft(dashboard.commitments[0].id);
    dashboard = await repository.getDashboardData();
    expect(dashboard.actions[0].status).toBe("pending_approval");

    repository.approveAndSaveDraft(dashboard.actions[0].id);
    dashboard = await repository.getDashboardData();
    expect(dashboard.actions[0].status).toBe("saved");
    expect(dashboard.commitments[0].status).toBe("completed");
  });

  it("deletes source-derived state without reseeding it", async () => {
    const dashboard = await repository.getDashboardData();
    repository.deleteSource(dashboard.commitments[0].sourceId);

    const afterDeletion = await repository.getDashboardData();
    expect(afterDeletion.commitments).toHaveLength(0);
    expect(afterDeletion.candidates).toHaveLength(0);
    expect(afterDeletion.sources.some((source) => source.id === "source-mercury-kickoff")).toBe(false);
  });

  it("can reset the seeded demo after deletion", async () => {
    await repository.resetDemoWorkspace();
    const dashboard = await repository.getDashboardData();
    expect(dashboard.candidates).toHaveLength(1);
    expect(dashboard.sources.some((source) => source.id === "source-mercury-kickoff")).toBe(true);
  });

  async function readyCommitment() {
    await repository.resetDemoWorkspace();
    const dashboard = await repository.getDashboardData();
    repository.approveCandidate({ candidateId: dashboard.candidates[0].id });
    await repository.ingestEvidence({ title: "Approval", content: "Maya: The final Project Mercury scope is approved." });
    return (await repository.getDashboardData()).commitments[0];
  }

  it("invalidates a stale draft when newer evidence is ambiguous", async () => {
    const commitment = await readyCommitment();
    await repository.prepareDraft(commitment.id);
    const oldDraft = (await repository.getDashboardData()).actions[0];
    await repository.ingestEvidence({ title: "Unclear update", content: "The team is still discussing next steps." });
    repository.approveAndSaveDraft(oldDraft.id);
    const dashboard = await repository.getDashboardData();
    expect(dashboard.commitments[0].status).toBe("uncertain");
    expect(dashboard.actions).toHaveLength(0);
    await repository.ingestEvidence({ title: "Reconfirmed", content: "Maya: The final Project Mercury scope is approved." });
    expect((await repository.getDashboardData()).commitments[0].status).toBe("ready");
  });

  it("deleting approval evidence removes drafts and invalidates readiness", async () => {
    const commitment = await readyCommitment();
    await repository.prepareDraft(commitment.id);
    const before = await repository.getDashboardData();
    repository.deleteSource(before.evaluations[0].sourceId);
    const after = await repository.getDashboardData();
    expect(after.actions).toHaveLength(0);
    expect(after.evaluations).toHaveLength(0);
    expect(after.commitments[0].status).toBe("uncertain");
    expect(after.auditEvents.some((event) => event.kind === "draft_prepared")).toBe(false);
  });

  it("does not partially persist a failed evidence batch", async () => {
    await readyCommitment();
    const before = await repository.getDashboardData();
    const spy = vi.spyOn(FixturePersonalAiProvider.prototype, "evaluateEvidence").mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(repository.ingestEvidence({ title: "Failed", content: "Unreachable provider" })).rejects.toThrow();
    spy.mockRestore();
    const after = await repository.getDashboardData();
    expect(after.sources).toEqual(before.sources);
    expect(after.commitments).toEqual(before.commitments);
    expect(after.evaluations).toEqual(before.evaluations);
  });

  it("discards a draft if approval is revoked during generation", async () => {
    const commitment = await readyCommitment();
    const spy = vi.spyOn(FixturePersonalAiProvider.prototype, "prepareDraft").mockImplementationOnce(async () => {
      await repository.ingestEvidence({ title: "Revoked", content: "Maya: I revoke approval of the Project Mercury scope." });
      return { title: "Stale", content: "This draft must not be stored." };
    });
    await expect(repository.prepareDraft(commitment.id)).rejects.toThrow("changed during drafting");
    spy.mockRestore();
    expect((await repository.getDashboardData()).actions).toHaveLength(0);
  });

  it("persists imported notes as candidates only, including an empty extraction", async () => {
    await repository.resetDemoWorkspace();
    const count = await repository.importSource({ title: "New note", project: "Project Mercury", content: "When Maya approves the final Project Mercury scope, prepare the proposal." });
    expect(count).toBe(1);
    expect((await repository.getDashboardData()).commitments).toHaveLength(0);
    expect(await repository.importSource({ title: "No action", project: "Project Mercury", content: "A discussion about weather." })).toBe(0);
  });
});
