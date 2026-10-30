import { z } from "zod";

export const candidateCommitmentSchema = z.object({
  commitmentText: z.string().trim().min(1).max(300),
  triggerText: z.string().trim().min(1).max(500),
  actor: z.string().trim().min(1).max(200).describe("The person whose action satisfies the condition, such as the approver. NOT the speaker, task owner, or person who will do the follow-up."),
  sourceQuote: z.string().trim().min(1).max(4000),
  confidence: z.number().min(0).max(1),
}).strict();

export const extractionSchema = z.object({
  candidates: z.array(candidateCommitmentSchema).max(8),
}).strict();

export const evidenceEvaluationSchema = z.object({
  outcome: z.enum(["satisfied", "unsatisfied", "uncertain", "revoked"]),
  explanation: z.string().trim().min(1).max(1500),
  sourceQuote: z.string().trim().min(1).max(4000),
}).strict();

export const draftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(6000),
}).strict();

export type CandidateCommitment = z.infer<typeof candidateCommitmentSchema>;
export type EvidenceEvaluation = z.infer<typeof evidenceEvaluationSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type EvidenceInput = {
  triggerText: string;
  expectedActor: string;
  evidence: string;
};
export type DraftInput = {
  project: string;
  commitment: string;
  trigger: string;
  evidence: string;
};

export interface PersonalAiProvider {
  readonly name: "fixture" | "token-factory";
  readonly model: string | null;
  extractCandidates(source: string): Promise<CandidateCommitment[]>;
  evaluateEvidence(input: EvidenceInput): Promise<EvidenceEvaluation>;
  prepareDraft(input: DraftInput): Promise<Draft>;
}
