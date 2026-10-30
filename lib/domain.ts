export const commitmentStatuses = [
  "waiting",
  "uncertain",
  "ready",
  "revoked",
  "completed",
  "expired",
] as const;

export type CommitmentStatus = (typeof commitmentStatuses)[number];

export type CommitmentEvent =
  | "ambiguous_evidence"
  | "condition_satisfied"
  | "condition_unsatisfied"
  | "user_confirms_evidence"
  | "user_rejects_evidence"
  | "approval_withdrawn"
  | "commitment_revoked"
  | "action_succeeded"
  | "expired";

const transitions: Record<
  CommitmentStatus,
  Partial<Record<CommitmentEvent, CommitmentStatus>>
> = {
  waiting: {
    ambiguous_evidence: "uncertain",
    condition_satisfied: "ready",
    condition_unsatisfied: "waiting",
    commitment_revoked: "revoked",
    expired: "expired",
  },
  uncertain: {
    ambiguous_evidence: "uncertain",
    condition_satisfied: "ready",
    condition_unsatisfied: "waiting",
    user_confirms_evidence: "ready",
    user_rejects_evidence: "waiting",
    commitment_revoked: "revoked",
    expired: "expired",
  },
  ready: {
    condition_satisfied: "ready",
    condition_unsatisfied: "waiting",
    ambiguous_evidence: "uncertain",
    approval_withdrawn: "waiting",
    commitment_revoked: "revoked",
    action_succeeded: "completed",
    expired: "expired",
  },
  revoked: {},
  completed: {},
  expired: {},
};

export function transitionCommitment(
  current: CommitmentStatus,
  event: CommitmentEvent,
): CommitmentStatus {
  const next = transitions[current][event];
  if (!next) {
    throw new Error(`Invalid commitment transition: ${current} -> ${event}`);
  }
  return next;
}

export function canPrepareAction(status: CommitmentStatus): boolean {
  return status === "ready";
}
