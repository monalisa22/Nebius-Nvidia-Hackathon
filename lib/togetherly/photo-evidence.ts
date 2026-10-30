import type Database from "better-sqlite3";
import type { Memory } from "../anubandh/types";
import { photoResultSchema, type PhotoEvidence } from "./photo-contracts";
import { sourceQuote } from "../ai/source-quote";

export function approvedPhotoEvidence(db: Database.Database, memory: Memory): PhotoEvidence | undefined {
  if (memory.status !== "approved" || (memory.expires_at && memory.expires_at <= Date.now())) return;
  const row = db.prepare(`SELECT a.id,a.reviewed FROM photo_analyses a
    JOIN photo_permissions p ON p.family_id=a.family_id AND p.enabled=1
    JOIN families f ON f.id=a.family_id AND f.cloud_consent=1
    WHERE a.source_id=? AND a.source_revision=? AND a.media_id=? AND a.status='approved'`).get(
    memory.id, memory.revision, memory.media_id,
  ) as { id: string; reviewed: string } | undefined;
  if (!row) return;
  const result = photoResultSchema.parse(JSON.parse(row.reviewed));
  return { id: row.id, mediaId: memory.media_id!, text: [result.description, ...result.observations].join("\n"), storyPrompt: result.storyPrompt };
}

export function resolveMemoryQuote(source: { caption: string; photoEvidence?: PhotoEvidence }, quote: string, evidenceId?: string | null) {
  if (!evidenceId) return sourceQuote(source.caption, quote);
  if (source.photoEvidence?.id !== evidenceId) return null;
  return sourceQuote(source.photoEvidence.text, quote);
}
