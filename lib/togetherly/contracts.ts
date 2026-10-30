import { z } from "zod";
import { ritualCommands } from "./ritual-contracts";
import { photoCommands } from "./photo-contracts";

const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(200);
const future = z.number().int().positive().refine(t => t > Date.now(), "Choose a future date.");
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a real calendar date.");
export const factSchema = z.object({
  personId: uuid,
  category: z.enum(["interest", "milestone", "birthday", "stated_feeling"]),
  quote: z.string().trim().min(1).max(1000),
});
export const extractionSchema = z.object({ facts: z.array(factSchema).max(8) });
export type FactProposal = z.infer<typeof factSchema>;

export const activityPrompts = {
  first_job: { title: "The first-job story", prompt: "Ask about their first job and save a story together." },
  recipe: { title: "A recipe to keep", prompt: "Record a favourite recipe in their own words." },
  photograph: { title: "Behind the photograph", prompt: "Choose a photograph together and ask what they remember about it." },
  song: { title: "A song between generations", prompt: "Ask about a favourite song and the memory that goes with it." },
  childhood: { title: "When you were my age", prompt: "Ask about a childhood day they would like to share." },
  meeting: { title: "How you first met", prompt: "Invite them to tell the story of meeting someone important." },
} as const;

export const commandSchema = z.discriminatedUnion("action", [
  ...ritualCommands,
  ...photoCommands,
  z.object({ action: z.literal("memory-context"), sourceId: uuid, revision: z.number().int().positive(), occurredOn: calendarDate.nullable(), place: z.string().trim().max(200), legacy: z.boolean() }),
  z.object({ action: z.literal("fact-propose"), sourceId: uuid, fact: factSchema }),
  z.object({ action: z.literal("fact-review"), id: uuid, decision: z.enum(["approved", "rejected"]) }),
  z.object({ action: z.literal("fact-delete"), id: uuid }),
  z.object({ action: z.literal("extract"), sourceId: uuid }),
  z.object({ action: z.literal("extraction-cancel"), id: uuid }),
  z.object({ action: z.literal("link-add"), fromId: uuid, toId: uuid, kind: z.enum(["parent", "partner", "sibling"]) }),
  z.object({ action: z.literal("link-delete"), id: uuid }),
  z.object({ action: z.literal("connection-log"), peerId: uuid, kind: z.enum(["call", "visit"]), happenedAt: z.number().int().positive().refine(t => t <= Date.now(), "A connection cannot be in the future.") }),
  z.object({ action: z.literal("connection-delete"), id: uuid }),
  z.object({ action: z.literal("preferences"), reminders: z.boolean(), quietDays: z.number().int().min(3).max(90), checkinEnabled: z.boolean(), trustedId: uuid.nullable(), checkinDays: z.number().int().min(1).max(30), autoInsights: z.boolean().default(false), memoryReminders: z.boolean().default(true) }),
  z.object({ action: z.literal("check-in") }),
  z.object({ action: z.literal("notice-read"), id: uuid }),
  z.object({ action: z.literal("anniversary-read"), id: uuid }),
  z.object({ action: z.literal("anniversary-dismiss"), id: uuid }),
  z.object({ action: z.literal("activity-create"), assigneeId: uuid, personId: uuid, promptKey: z.enum(["first_job", "recipe", "photograph", "song", "childhood", "meeting"]) }),
  z.object({ action: z.literal("activity-update"), id: uuid, operation: z.enum(["accept", "decline", "cancel", "complete"]), evidenceId: uuid.optional() }),
  z.object({ action: z.literal("capsule-create"), recipientId: uuid, title, text: z.string().trim().max(4000).default(""), mediaId: uuid.nullable().default(null), deliverAt: future }),
  z.object({ action: z.literal("capsule-approve"), id: uuid, revision: z.number().int().positive() }),
  z.object({ action: z.literal("capsule-cancel"), id: uuid, revision: z.number().int().positive() }),
  z.object({ action: z.literal("capsule-reschedule"), id: uuid, revision: z.number().int().positive(), deliverAt: future }),
  z.object({ action: z.literal("walk-create"), title, sourceIds: z.array(uuid).min(1).max(30) }),
  z.object({ action: z.literal("walk-progress"), id: uuid, position: z.number().int().min(0).max(29), status: z.enum(["active", "paused", "completed"]) }),
  z.object({ action: z.literal("walk-delete"), id: uuid }),
  z.object({ action: z.literal("session-start"), personId: uuid }),
  z.object({ action: z.literal("session-end"), id: uuid }),
]);
export type CompanionCommand = z.infer<typeof commandSchema>;
export type Fact = { id: string; source_id: string; source_revision: number; person_id: string; category: FactProposal["category"]; quote: string; status: string; proposed_by: string; created_at: number };
export type Preferences = { member_id: string; reminders: number; quiet_days: number; checkin_enabled: number; trusted_id: string | null; checkin_days: number; checked_in_at: number; auto_insights: number; memory_reminders: number };
export type Capsule = { id: string; message_id: string; title: string; deliver_at: number; status: string; revision: number; error: string | null; approved_at: number | null };
export type Activity = { id: string; family_id: string; creator_id: string; assignee_id: string; person_id: string; prompt_key: keyof typeof activityPrompts; status: string; evidence_id: string | null; created_at: number; completed_at: number | null };
export type ExtractionJob = { id: string; member_id: string; source_id: string; source_revision: number; status: string; attempts: number; lease_token: string | null; lease_until: number | null; run_after: number; error: string | null; created_at: number; provider: string | null; model: string | null };
export type AnniversaryNotice = { id: string; member_id: string; source_id: string; event_on: string; anniversary_year: number; years_ago: number; created_at: number; read_at: number | null; dismissed_at: number | null };
