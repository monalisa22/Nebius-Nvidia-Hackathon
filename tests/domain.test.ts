import { describe, expect, it } from "vitest";

import { canPrepareAction, transitionCommitment } from "../lib/domain";

describe("commitment state machine", () => {
  it("moves a waiting commitment to ready only on satisfied evidence", () => {
    expect(transitionCommitment("waiting", "condition_satisfied")).toBe("ready");
    expect(transitionCommitment("waiting", "condition_unsatisfied")).toBe("waiting");
  });

  it("routes ambiguous evidence through explicit user review", () => {
    expect(transitionCommitment("waiting", "ambiguous_evidence")).toBe("uncertain");
    expect(transitionCommitment("uncertain", "user_rejects_evidence")).toBe("waiting");
    expect(transitionCommitment("uncertain", "user_confirms_evidence")).toBe("ready");
  });

  it("allows action preparation only from ready", () => {
    expect(canPrepareAction("ready")).toBe(true);
    expect(canPrepareAction("waiting")).toBe(false);
    expect(canPrepareAction("uncertain")).toBe(false);
    expect(canPrepareAction("completed")).toBe(false);
  });

  it("prevents terminal commitments from executing again", () => {
    expect(() => transitionCommitment("completed", "action_succeeded")).toThrow(
      "Invalid commitment transition",
    );
    expect(() => transitionCommitment("revoked", "condition_satisfied")).toThrow(
      "Invalid commitment transition",
    );
  });

  it("supports revocation before execution", () => {
    expect(transitionCommitment("waiting", "commitment_revoked")).toBe("revoked");
    expect(transitionCommitment("ready", "commitment_revoked")).toBe("revoked");
  });

  it("rechecks ambiguous memory and blocks stale approvals", () => {
    expect(transitionCommitment("uncertain", "condition_satisfied")).toBe("ready");
    expect(transitionCommitment("uncertain", "condition_unsatisfied")).toBe("waiting");
    expect(transitionCommitment("ready", "ambiguous_evidence")).toBe("uncertain");
    expect(transitionCommitment("ready", "condition_unsatisfied")).toBe("waiting");
    expect(transitionCommitment("ready", "condition_satisfied")).toBe("ready");
  });
});
