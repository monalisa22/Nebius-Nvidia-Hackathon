import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { FixturePersonalAiProvider } from "@/lib/ai/fixture-provider";
import { AiProviderError } from "@/lib/ai/errors";
import { getPersonalAiProvider } from "@/lib/ai/provider";
import type { EvidenceEvaluation } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import {
  canPrepareAction,
  transitionCommitment,
  type CommitmentEvent,
  type CommitmentStatus,
} from "@/lib/domain";
import {
  actionProposals,
  auditEvents,
  candidates,
  commitments,
  deletionTombstones,
  evidenceEvaluations,
  skillDefinitions,
  sources,
} from "@/lib/schema";

const fixtureProvider = new FixturePersonalAiProvider();

const DEMO_SOURCE_ID = "source-mercury-kickoff";
const DEMO_CANDIDATE_ID = "candidate-mercury-proposal";
const FOLLOW_UP_SKILL_ID = "skill-prepare-client-follow-up";
const BRIEFING_SKILL_ID = "skill-daily-briefing";

function now(): number {
  return Date.now();
}

function audit(input: {
  entityType: string;
  entityId: string;
  kind: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  db.insert(auditEvents)
    .values({
      id: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      kind: input.kind,
      summary: input.summary,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now(),
    })
    .run();
}

export async function ensureDemoData() {
  db.insert(skillDefinitions)
    .values([
      {
        id: FOLLOW_UP_SKILL_ID,
        name: "Prepare client follow-up",
        description: "Creates an evidence-backed follow-up draft.",
        allowedSourcesJson: JSON.stringify(["Commitment project"]),
        allowedToolsJson: JSON.stringify(["create_draft", "save_draft"]),
        approvalPolicy: "User approval required; local save only",
        version: 2,
      },
      {
        id: BRIEFING_SKILL_ID,
        name: "Daily follow-through briefing",
        description: "Summarizes ready, waiting, and uncertain commitments.",
        allowedSourcesJson: JSON.stringify(["Approved project sources"]),
        allowedToolsJson: JSON.stringify([]),
        approvalPolicy: "Read-only",
        version: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  db.update(skillDefinitions).set({
    description: "Creates an evidence-backed follow-up draft.",
    allowedSourcesJson: JSON.stringify(["Commitment project"]),
    approvalPolicy: "User approval required; local save only",
    version: 2,
  }).where(and(eq(skillDefinitions.id, FOLLOW_UP_SKILL_ID), eq(skillDefinitions.version, 1))).run();

  const deletedDemoSource = db
    .select()
    .from(deletionTombstones)
    .where(
      and(
        eq(deletionTombstones.entityType, "source"),
        eq(deletionTombstones.entityId, DEMO_SOURCE_ID),
      ),
    )
    .get();

  if (deletedDemoSource) return;

  db.insert(sources)
    .values({
      id: DEMO_SOURCE_ID,
      project: "Project Mercury",
      kind: "meeting_note",
      title: "Mercury scope review",
      content:
        "Maya: The scope needs one final client review.\nAlex: When Maya approves the final Project Mercury scope, prepare the proposal using our standard format. Ask me before saving or sending it.",
      createdAt: now() - 1000 * 60 * 35,
    })
    .onConflictDoNothing()
    .run();

  const [extracted] = await fixtureProvider.extractCandidates(
    "When Maya approves the final Project Mercury scope, prepare the proposal using our standard format. Ask me before saving or sending it.",
  );

  db.insert(candidates)
    .values({
      id: DEMO_CANDIDATE_ID,
      sourceId: DEMO_SOURCE_ID,
      project: "Project Mercury",
      commitmentText: extracted.commitmentText,
      triggerText: extracted.triggerText,
      actor: extracted.actor,
      sourceQuote: extracted.sourceQuote,
      confidence: extracted.confidence,
      status: "pending",
      createdAt: now() - 1000 * 60 * 34,
    })
    .onConflictDoNothing()
    .run();
}

export async function getDashboardData() {
  await ensureDemoData();

  const candidateRows = db
    .select()
    .from(candidates)
    .where(eq(candidates.status, "pending"))
    .orderBy(desc(candidates.createdAt))
    .all();

  const commitmentRows = db
    .select()
    .from(commitments)
    .orderBy(desc(commitments.updatedAt))
    .all();

  const evaluationRows = db
    .select()
    .from(evidenceEvaluations)
    .orderBy(desc(evidenceEvaluations.createdAt))
    .all();

  const actionRows = db
    .select()
    .from(actionProposals)
    .orderBy(desc(actionProposals.createdAt))
    .all();

  const auditRows = db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(12)
    .all();

  const sourceRows = db
    .select()
    .from(sources)
    .orderBy(desc(sources.createdAt))
    .all();

  const skillRows = db.select().from(skillDefinitions).orderBy(asc(skillDefinitions.name)).all();
  const imports = db.select().from(auditEvents).where(eq(auditEvents.kind, "source_imported")).all();

  return {
    candidates: candidateRows.map((candidate) => {
      const receipt = imports.find((event) => event.entityId === candidate.sourceId);
      const metadata = receipt ? JSON.parse(receipt.metadataJson) : {};
      return { ...candidate, provider: metadata.provider ?? "fixture", model: metadata.model ?? null };
    }),
    commitments: commitmentRows,
    evaluations: evaluationRows,
    actions: actionRows,
    auditEvents: auditRows,
    sources: sourceRows,
    skills: skillRows,
  };
}

export async function importSource(input: { title: string; project: string; content: string }) {
  const provider = getPersonalAiProvider();
  const extracted = await provider.extractCandidates(input.content);
  const sourceId = randomUUID();
  const timestamp = now();
  db.transaction((tx) => {
    tx.insert(sources).values({
      id: sourceId, ...input, kind: "meeting_note", createdAt: timestamp,
    }).run();
    if (extracted.length) {
      tx.insert(candidates).values(extracted.map((candidate) => ({
        ...candidate, id: randomUUID(), sourceId, project: input.project,
        status: "pending", createdAt: timestamp,
      }))).run();
    }
    audit({
      entityType: "source", entityId: sourceId, kind: "source_imported",
      summary: `${extracted.length} candidate memories extracted for review.`,
      metadata: { provider: provider.name, model: provider.model, purpose: "extract_candidates", sourceIds: [sourceId] },
    });
  });
  return extracted.length;
}

export function approveCandidate(input: {
  candidateId: string;
  title?: string;
  triggerText?: string;
  actor?: string;
}) {
  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId))
    .get();

  if (!candidate || candidate.status !== "pending") return;

  const existing = db
    .select()
    .from(commitments)
    .where(eq(commitments.candidateId, candidate.id))
    .get();
  if (existing) return;

  const commitmentId = randomUUID();
  const timestamp = now();
  db.transaction((tx) => {
    tx.update(candidates)
      .set({ status: "approved" })
      .where(eq(candidates.id, candidate.id))
      .run();
    tx.insert(commitments)
      .values({
        id: commitmentId,
        candidateId: candidate.id,
        sourceId: candidate.sourceId,
        project: candidate.project,
        title: input.title?.trim() || candidate.commitmentText,
        triggerText: input.triggerText?.trim() || candidate.triggerText,
        actor: input.actor?.trim() || candidate.actor,
        status: "waiting",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  });

  audit({
    entityType: "commitment",
    entityId: commitmentId,
    kind: "memory_approved",
    summary: "Commitment approved and stored with its source evidence.",
    metadata: { sourceId: candidate.sourceId },
  });
}

export function rejectCandidate(candidateId: string) {
  db.update(candidates)
    .set({ status: "rejected" })
    .where(and(eq(candidates.id, candidateId), eq(candidates.status, "pending")))
    .run();
  audit({
    entityType: "candidate",
    entityId: candidateId,
    kind: "memory_rejected",
    summary: "Candidate memory rejected by the user.",
  });
}

function eventForEvaluation(evaluation: EvidenceEvaluation): CommitmentEvent {
  switch (evaluation.outcome) {
    case "satisfied":
      return "condition_satisfied";
    case "unsatisfied":
      return "condition_unsatisfied";
    case "revoked":
      return "commitment_revoked";
    case "uncertain":
      return "ambiguous_evidence";
  }
}

export async function ingestEvidence(input: {
  title: string;
  content: string;
  project?: string;
}) {
  const content = input.content.trim();
  if (!content) return;

  const sourceId = randomUUID();
  const timestamp = now();
  const project = input.project?.trim() || "Project Mercury";
  const activeCommitments = db
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.project, project),
        inArray(commitments.status, ["waiting", "uncertain", "ready"]),
      ),
    )
    .all();

  if (activeCommitments.length > 12) {
    throw new AiProviderError("This local prototype supports evaluating up to 12 active commitments per project at once.");
  }
  const provider = getPersonalAiProvider();
  const results: { commitment: typeof activeCommitments[number]; evaluation: EvidenceEvaluation }[] = [];
  for (const commitment of activeCommitments) {
    const evaluation = await provider.evaluateEvidence({
      triggerText: commitment.triggerText,
      expectedActor: commitment.actor,
      evidence: content,
    });
    results.push({ commitment, evaluation });
  }

  // Complete all model calls before writing; a failed or stale batch has no partial effects.
  db.transaction((tx) => {
    const current = tx.select().from(commitments).where(and(
      eq(commitments.project, project), inArray(commitments.status, ["waiting", "uncertain", "ready"]),
    )).all();
    if (current.length !== activeCommitments.length || activeCommitments.some((before) =>
      !current.some((after) => after.id === before.id && after.status === before.status && after.updatedAt === before.updatedAt))) {
      throw new AiProviderError("Commitments changed during evaluation. No changes were saved; please retry.");
    }
    tx.insert(sources).values({
      id: sourceId, project, kind: "project_update", title: input.title.trim() || "Project update",
      content, createdAt: timestamp,
    }).run();

    for (const { commitment, evaluation } of results) {
      const nextStatus = transitionCommitment(commitment.status as CommitmentStatus, eventForEvaluation(evaluation));
      tx.insert(evidenceEvaluations)
        .values({
          id: randomUUID(),
          commitmentId: commitment.id,
          sourceId,
          outcome: evaluation.outcome,
          explanation: evaluation.explanation,
          sourceQuote: evaluation.sourceQuote,
          createdAt: timestamp,
        })
        .run();
      tx.update(commitments)
        .set({ status: nextStatus, updatedAt: Math.max(now(), commitment.updatedAt + 1) })
        .where(eq(commitments.id, commitment.id))
        .run();
      tx.delete(actionProposals).where(and(
        eq(actionProposals.commitmentId, commitment.id), eq(actionProposals.status, "pending_approval"),
      )).run();
      audit({
      entityType: "commitment",
      entityId: commitment.id,
      kind: `evidence_${evaluation.outcome}`,
        summary: `New evidence evaluated: ${evaluation.outcome}.`,
        metadata: { sourceId, previousStatus: commitment.status, nextStatus, provider: provider.name, model: provider.model, purpose: "evaluate_evidence" },
      });
    }
  });
  return results.length;
}

export function resolveUncertain(commitmentId: string, approved: boolean) {
  const commitment = db
    .select()
    .from(commitments)
    .where(eq(commitments.id, commitmentId))
    .get();
  if (!commitment || commitment.status !== "uncertain") return;

  const nextStatus = transitionCommitment(
    "uncertain",
    approved ? "user_confirms_evidence" : "user_rejects_evidence",
  );
  db.update(commitments)
    .set({ status: nextStatus, updatedAt: now() })
    .where(eq(commitments.id, commitmentId))
    .run();
  audit({
    entityType: "commitment",
    entityId: commitmentId,
    kind: approved ? "evidence_confirmed" : "evidence_rejected",
    summary: approved
      ? "User confirmed the evidence and marked the commitment ready."
      : "User rejected the interpretation; the commitment remains waiting.",
  });
}

function requireSkill(tool: "create_draft" | "save_draft", project: string) {
  const skill = db.select().from(skillDefinitions).where(eq(skillDefinitions.id, FOLLOW_UP_SKILL_ID)).get();
  if (!skill || !JSON.parse(skill.allowedToolsJson).includes(tool) ||
      !JSON.parse(skill.allowedSourcesJson).some((source: string) => source === "Commitment project" || source === project)) {
    throw new AiProviderError("The follow-up skill does not permit this tool or project.");
  }
  return skill;
}

export async function prepareDraft(commitmentId: string) {
  const commitment = db
    .select()
    .from(commitments)
    .where(eq(commitments.id, commitmentId))
    .get();
  if (!commitment || !canPrepareAction(commitment.status as CommitmentStatus)) return;

  const existing = db
    .select()
    .from(actionProposals)
    .where(
      and(
        eq(actionProposals.commitmentId, commitmentId),
        inArray(actionProposals.status, ["pending_approval", "saved"]),
      ),
    )
    .get();
  if (existing) return;

  const skill = requireSkill("create_draft", commitment.project);
  const evidence = db.select().from(evidenceEvaluations).where(eq(evidenceEvaluations.commitmentId, commitmentId))
    .orderBy(desc(evidenceEvaluations.createdAt)).get();
  if (!evidence) throw new AiProviderError("There is no source evidence for this draft.");
  const provider = getPersonalAiProvider();
  const draft = await provider.prepareDraft({
    project: commitment.project, commitment: commitment.title,
    trigger: commitment.triggerText, evidence: evidence.sourceQuote,
  });

  const proposalId = randomUUID();
  db.transaction((tx) => {
    const current = tx.select().from(commitments).where(eq(commitments.id, commitmentId)).get();
    if (!current || current.status !== "ready" || current.updatedAt !== commitment.updatedAt) {
      throw new AiProviderError("The commitment changed during drafting. The draft was discarded; please retry.");
    }
    requireSkill("create_draft", current.project);
    if (tx.select().from(actionProposals).where(eq(actionProposals.commitmentId, commitmentId)).get()) return;
    tx.insert(actionProposals)
    .values({
      id: proposalId,
      commitmentId,
      skillId: FOLLOW_UP_SKILL_ID,
      title: draft.title,
      content: draft.content,
      status: "pending_approval",
      createdAt: now(),
      approvedAt: null,
      executedAt: null,
    })
    .run();
  audit({
    entityType: "action",
    entityId: proposalId,
    kind: "draft_prepared",
    summary: "Follow-up drafted; local save requires user approval.",
    metadata: { skillId: skill.id, skillVersion: skill.version, provider: provider.name, model: provider.model, sourceIds: [commitment.sourceId, evidence.sourceId], purpose: "prepare_draft" },
  });
  });
}

export function approveAndSaveDraft(proposalId: string) {
  const proposal = db
    .select()
    .from(actionProposals)
    .where(eq(actionProposals.id, proposalId))
    .get();
  if (!proposal || proposal.status !== "pending_approval") return;

  const commitment = db
    .select()
    .from(commitments)
    .where(eq(commitments.id, proposal.commitmentId))
    .get();
  if (!commitment || commitment.status !== "ready") return;
  requireSkill("save_draft", commitment.project);

  const timestamp = now();
  const nextStatus = transitionCommitment("ready", "action_succeeded");
  db.transaction((tx) => {
    tx.update(actionProposals)
      .set({ status: "saved", approvedAt: timestamp, executedAt: timestamp })
      .where(eq(actionProposals.id, proposalId))
      .run();
    tx.update(commitments)
      .set({ status: nextStatus, updatedAt: timestamp })
      .where(eq(commitments.id, commitment.id))
      .run();
  });
  audit({
    entityType: "action",
    entityId: proposalId,
    kind: "draft_saved",
    summary: "User approved the follow-up and saved it locally. Nothing was sent.",
    metadata: { tool: "save_draft", commitmentId: commitment.id },
  });
}

export function deleteSource(sourceId: string) {
  const relatedCommitments = db
    .select({ id: commitments.id })
    .from(commitments)
    .where(eq(commitments.sourceId, sourceId))
    .all();

  const evidenceCommitments = db.select({ id: evidenceEvaluations.commitmentId })
    .from(evidenceEvaluations).where(eq(evidenceEvaluations.sourceId, sourceId)).all();
  const affectedIds = [...new Set([...relatedCommitments, ...evidenceCommitments].map((row) => row.id))];
  const affectedActions = affectedIds.length ? db.select({ id: actionProposals.id }).from(actionProposals)
    .where(inArray(actionProposals.commitmentId, affectedIds)).all() : [];
  const affectedCandidates = db.select({ id: candidates.id }).from(candidates).where(eq(candidates.sourceId, sourceId)).all();

  db.transaction((tx) => {
    if (affectedIds.length) {
      tx.delete(actionProposals).where(inArray(actionProposals.commitmentId, affectedIds)).run();
      tx.update(commitments).set({ status: "uncertain", updatedAt: now() })
        .where(and(inArray(commitments.id, affectedIds), inArray(commitments.status, ["ready", "waiting", "uncertain", "completed"]))).run();
    }
    const relatedEntities = [sourceId, ...affectedIds, ...affectedActions.map((row) => row.id), ...affectedCandidates.map((row) => row.id)];
    tx.delete(auditEvents).where(inArray(auditEvents.entityId, relatedEntities)).run();
    tx.delete(sources).where(eq(sources.id, sourceId)).run();
    tx.insert(deletionTombstones)
      .values({
        id: randomUUID(),
        entityType: "source",
        entityId: sourceId,
        deletedAt: now(),
      })
      .run();
  });
  audit({
    entityType: "source",
    entityId: sourceId,
    kind: "source_deleted",
    summary: "Source removed; derived drafts deleted and dependent approvals invalidated.",
    metadata: { removedCommitments: relatedCommitments.map((row) => row.id) },
  });
}

export async function resetDemoWorkspace() {
  db.transaction((tx) => {
    tx.delete(actionProposals).run();
    tx.delete(evidenceEvaluations).run();
    tx.delete(commitments).run();
    tx.delete(candidates).run();
    tx.delete(sources).run();
    tx.delete(auditEvents).run();
    tx.delete(deletionTombstones).run();
  });
  await ensureDemoData();
}
