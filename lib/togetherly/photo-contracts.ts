import { z } from "zod";

export const photoThemes = {
  celebrations: "Our celebrations", diwali: "Our Diwali memories",
  meals: "Around the family table", music: "Music in our family",
  outdoors: "Out in the open", travel: "Places we shared", everyday: "Little everyday moments",
} as const;
export const photoThemeSchema = z.enum(["celebrations", "diwali", "meals", "music", "outdoors", "travel", "everyday"]);
export const photoResultSchema = z.object({
  description: z.string().trim().min(1).max(600),
  observations: z.array(z.string().trim().min(1).max(200)).max(5),
  themes: z.array(photoThemeSchema).max(4),
  storyPrompt: z.string().trim().min(1).max(220),
}).strict();
export type PhotoResult = z.infer<typeof photoResultSchema>;
export const photoCommands = [
  z.object({ action: z.literal("photo-permission"), enabled: z.boolean() }),
  z.object({ action: z.literal("photo-analyze"), sourceId: z.string().uuid() }),
  z.object({ action: z.literal("photo-cancel"), id: z.string().uuid() }),
  z.object({ action: z.literal("photo-review"), id: z.string().uuid(), revision: z.number().int().positive(), content: photoResultSchema }),
  z.object({ action: z.literal("photo-dismiss"), id: z.string().uuid(), revision: z.number().int().positive() }),
] as const;
export const photoCommandSchema = z.discriminatedUnion("action", photoCommands);
export type PhotoJob = {
  id: string; family_id: string; member_id: string; source_id: string; source_revision: number;
  media_id: string; status: "queued" | "running" | "ready" | "approved" | "failed" | "cancelled" | "dismissed";
  revision: number; attempts: number; lease_token: string | null; lease_until: number | null;
  result: string | null; reviewed: string | null; provider: string | null; model: string | null;
  error: string | null; created_at: number;
};
export type PhotoEvidence = { id: string; text: string; mediaId: string; storyPrompt: string };
