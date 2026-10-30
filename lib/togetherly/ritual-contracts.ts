import { z } from "zod";

export const ritualSkills = {
  call: {
    version: 1,
    name: "Before our call",
    purpose: "Prepare a short, source-linked conversation using an approved personal routine.",
    proposal: "reply.offer",
  },
  reconnect: {
    version: 1,
    name: "A little catch-up",
    purpose: "Prepare a personal catch-up using the chosen family memories.",
    proposal: "reply.offer",
  },
  story: {
    version: 1,
    name: "A story between us",
    purpose: "Find a thread in the chosen memories and invite a family story, without testing recall.",
    proposal: "walk.offer",
  },
} as const;

const uuid = z.string().uuid();
export const callSkillSchema = z.object({
  maxMoments: z.number().int().min(1).max(3),
  questionCount: z.number().int().min(1).max(3),
  focus: z.enum(["recent", "mixed"]),
  tone: z.enum(["simple", "warm"]),
}).strict();
export type CallSkill = z.infer<typeof callSkillSchema>;
export const defaultCallSkill: CallSkill = { maxMoments: 3, questionCount: 2, focus: "mixed", tone: "simple" };
export const ritualSettingsSchema = z.object({
  skill: z.enum(["call", "reconnect", "story"]),
  recipientId: uuid,
  sourceIds: z.array(uuid).min(1).max(12).refine(v => new Set(v).size === v.length, "Choose each memory once."),
  cadence: z.enum(["manual", "daily", "weekly", "before-call"]),
  allowAction: z.boolean(),
  expiresAt: z.number().int().positive().nullable(),
  engine: z.enum(["direct", "hermes"]).default("direct"),
});
export const ritualCommands = [
  ritualSettingsSchema.extend({ action: z.literal("ritual-save"), id: uuid.optional(), revision: z.number().int().positive().optional() }),
  z.object({ action: z.literal("ritual-run"), id: uuid }),
  z.object({ action: z.literal("ritual-toggle"), id: uuid, revision: z.number().int().positive(), enabled: z.boolean() }),
  z.object({ action: z.literal("ritual-delete"), id: uuid }),
  z.object({ action: z.literal("ritual-dismiss"), id: uuid }),
  z.object({ action: z.literal("ritual-approve"), id: uuid, text: z.string().trim().min(1).max(1500) }),
  z.object({ action: z.literal("ritual-learn"), id: uuid, instruction: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("ritual-skill-approve"), id: uuid }),
] as const;
export const ritualCommandSchema = z.discriminatedUnion("action", ritualCommands);
export type RitualCommand = z.infer<typeof ritualCommandSchema>;
export type RitualSettings = z.infer<typeof ritualSettingsSchema>;

export const ritualResultSchema = z.object({
  title: z.string().trim().min(1).max(100),
  moments: z.array(z.object({
    sourceId: uuid,
    evidenceId: uuid.nullable().optional(),
    quote: z.string().trim().min(1).max(1200),
    caption: z.string().trim().min(1).max(220),
    question: z.string().trim().max(220),
  }).strict()).min(1).max(3),
  proposal: z.object({
    tool: z.enum(["reply.offer", "walk.offer", "none"]),
    text: z.string().trim().max(600),
    sourceIds: z.array(uuid).max(3),
  }).strict(),
}).strict();
export type RitualResult = z.infer<typeof ritualResultSchema>;
export type Ritual = {
  id: string; member_id: string; recipient_id: string; skill: keyof typeof ritualSkills;
  source_ids: string; cadence: RitualSettings["cadence"]; allow_action: number;
  enabled: number; revision: number; expires_at: number | null; next_run_at: number | null; created_at: number;
  engine: "direct" | "hermes"; skill_config: string;
};
export type RitualReceipt = { tool: string; status: "completed" | "awaiting-approval"; at: number };
export type RitualRun = {
  id: string; ritual_id: string; revision: number; fingerprint: string | null;
  status: "queued" | "running" | "ready" | "applied" | "dismissed" | "failed" | "expired" | "cancelled";
  attempts: number; lease_token: string | null; lease_until: number | null;
  run_after: number; created_at: number; expires_at: number; error: string | null;
  result: string | null; receipt: string; provider: string | null; model: string | null; outcome_id: string | null;
  task: "prepare" | "learn"; instruction: string | null; skill_proposal: string | null;
};
