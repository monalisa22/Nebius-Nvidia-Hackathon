"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiProviderError } from "@/lib/ai/errors";
import { providerStatus } from "@/lib/ai/provider";
import type { ActionState } from "@/app/ai-form";

import {
  approveAndSaveDraft,
  approveCandidate,
  deleteSource,
  ingestEvidence,
  importSource,
  prepareDraft,
  rejectCandidate,
  resetDemoWorkspace,
  resolveUncertain,
} from "@/lib/repository";

function refresh() {
  revalidatePath("/");
}

const idSchema = z.string().min(1).max(100);
const candidateReviewSchema = z.object({
  candidateId: idSchema,
  title: z.string().trim().min(3).max(300),
  triggerText: z.string().trim().min(3).max(500),
  actor: z.string().trim().min(1).max(200),
});
const evidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(3).max(20_000),
  project: z.string().trim().min(1).max(200),
});

export async function approveCandidateAction(formData: FormData) {
  const input = candidateReviewSchema.parse({
    candidateId: String(formData.get("candidateId")),
    title: String(formData.get("title") ?? ""),
    triggerText: String(formData.get("triggerText") ?? ""),
    actor: String(formData.get("actor") ?? ""),
  });
  approveCandidate(input);
  refresh();
}

export async function rejectCandidateAction(formData: FormData) {
  rejectCandidate(idSchema.parse(String(formData.get("candidateId"))));
  refresh();
}

function requireConsent(formData: FormData) {
  if (providerStatus().mode === "token-factory" && formData.get("consent") !== "on") {
    throw new AiProviderError("Approve the stated Nebius context access before continuing.");
  }
}

async function runAiAction(work: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return { message, error: false };
  } catch (error) {
    return {
      message: error instanceof AiProviderError ? error.message
        : error instanceof z.ZodError ? "Check all fields and keep notes under 20,000 characters."
        : "The operation could not be completed. Please refresh and retry.",
      error: true,
    };
  }
}

export async function importSourceAction(_state: ActionState, formData: FormData) {
  return runAiAction(async () => {
    requireConsent(formData);
    const input = evidenceSchema.parse(Object.fromEntries(formData));
    const count = await importSource(input);
    return count ? `${count} candidate memories ready for review.` : "Note saved. No conditional commitments found.";
  });
}

export async function ingestEvidenceAction(_state: ActionState, formData: FormData) {
  return runAiAction(async () => {
    requireConsent(formData);
    const input = evidenceSchema.parse(Object.fromEntries(formData));
    const count = await ingestEvidence(input);
    return `Evidence saved. ${count ?? 0} commitments evaluated.`;
  });
}

export async function resolveUncertainAction(formData: FormData) {
  resolveUncertain(
    idSchema.parse(String(formData.get("commitmentId"))),
    String(formData.get("decision")) === "approve",
  );
  refresh();
}

export async function prepareDraftAction(_state: ActionState, formData: FormData) {
  return runAiAction(async () => {
    requireConsent(formData);
    await prepareDraft(idSchema.parse(String(formData.get("commitmentId"))));
    return "Follow-up prepared for review.";
  });
}

export async function approveDraftAction(formData: FormData) {
  approveAndSaveDraft(idSchema.parse(String(formData.get("proposalId"))));
  refresh();
}

export async function deleteSourceAction(formData: FormData) {
  deleteSource(idSchema.parse(String(formData.get("sourceId"))));
  refresh();
}

export async function resetDemoAction() {
  await resetDemoWorkspace();
  refresh();
}
