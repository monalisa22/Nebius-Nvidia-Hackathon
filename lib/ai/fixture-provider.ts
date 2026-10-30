import type {
  CandidateCommitment,
  EvidenceEvaluation,
  PersonalAiProvider,
  DraftInput,
} from "@/lib/ai/schemas";

function firstMatchingLine(content: string, words: string[]): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => words.some((word) => line.toLowerCase().includes(word))) ??
    lines[0] ??
    content.trim()
  );
}

export class FixturePersonalAiProvider implements PersonalAiProvider {
  readonly name = "fixture" as const;
  readonly model = null;

  async extractCandidates(source: string): Promise<CandidateCommitment[]> {
    if (!source.includes("When Maya approves the final Project Mercury scope")) return [];
    const quote = firstMatchingLine(source, ["when", "after", "once", "prepare"]);
    return [{
      commitmentText: "Prepare the Project Mercury proposal using the approved scope",
      triggerText: "Maya explicitly approves the final Project Mercury scope",
      actor: "Maya",
      sourceQuote: quote,
      confidence: 0.94,
    }];
  }

  async evaluateEvidence(input: {
    triggerText: string;
    expectedActor: string;
    evidence: string;
  }): Promise<EvidenceEvaluation> {
    const content = input.evidence.toLowerCase();
    const quote = firstMatchingLine(input.evidence, [
      "approved",
      "pending",
      "withdraw",
      "revoke",
      "scope",
    ]);

    if (content.includes("withdraw") || content.includes("revok")) {
      return {
        outcome: "revoked",
        explanation: "Newer evidence withdraws the approval or the commitment.",
        sourceQuote: quote,
      };
    }

    if (content.includes("pending") || content.includes("internally")) {
      return {
        outcome: "unsatisfied",
        explanation:
          "The update mentions progress, but explicit client approval is still pending.",
        sourceQuote: quote,
      };
    }

    if (
      content.includes("maya") &&
      content.includes("approv") &&
      content.includes("scope")
    ) {
      return {
        outcome: "satisfied",
        explanation:
          "Maya explicitly approved the final scope, matching the stored trigger.",
        sourceQuote: quote,
      };
    }

    return {
      outcome: "uncertain",
      explanation:
        "The update may be relevant, but it does not provide enough evidence to activate the commitment.",
      sourceQuote: quote,
    };
  }

  async prepareDraft(input: DraftInput) {
    return {
      title: `${input.project} follow-up`,
      content: `Hello,\n\nFollowing up on: ${input.commitment}.\n\nConfirmed context: ${input.evidence}\n\nI will prepare the next steps for your review.`,
    };
  }
}
