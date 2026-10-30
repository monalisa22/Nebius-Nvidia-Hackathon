import type Database from "better-sqlite3";
import { initializeRitualTables } from "./ritual-schema";
import { initializePhotoTables } from "./photo-schema";

export function initializeCompanionTables(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_context(
        source_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
        occurred_on TEXT, place TEXT NOT NULL DEFAULT '', legacy INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS person_facts(
        id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        source_revision INTEGER NOT NULL, person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        category TEXT NOT NULL, quote TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        proposed_by TEXT NOT NULL REFERENCES members(id), created_at INTEGER NOT NULL,
        UNIQUE(source_id,source_revision,person_id,category,quote)
      );
      CREATE TABLE IF NOT EXISTS family_links(
        id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        from_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        to_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, UNIQUE(from_id,to_id,kind)
      );
      CREATE TABLE IF NOT EXISTS connection_events(
        id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES members(id), peer_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL, happened_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companion_preferences(
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        reminders INTEGER NOT NULL DEFAULT 0, quiet_days INTEGER NOT NULL DEFAULT 21,
        checkin_enabled INTEGER NOT NULL DEFAULT 0, trusted_id TEXT REFERENCES members(id),
        checkin_days INTEGER NOT NULL DEFAULT 3, checked_in_at INTEGER NOT NULL,
        auto_insights INTEGER NOT NULL DEFAULT 0,
        memory_reminders INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS companion_notices(
        id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES members(id),
        subject_id TEXT NOT NULL REFERENCES members(id), baseline INTEGER NOT NULL,
        created_at INTEGER NOT NULL, read_at INTEGER,
        UNIQUE(recipient_id,subject_id,baseline)
      );
      CREATE TABLE IF NOT EXISTS memory_anniversary_notices(
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        event_on TEXT NOT NULL, anniversary_year INTEGER NOT NULL, years_ago INTEGER NOT NULL,
        created_at INTEGER NOT NULL, read_at INTEGER, dismissed_at INTEGER,
        UNIQUE(member_id,source_id,anniversary_year)
      );
      CREATE TABLE IF NOT EXISTS family_activities(
        id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES members(id), assignee_id TEXT NOT NULL REFERENCES members(id),
        person_id TEXT NOT NULL REFERENCES people(id), prompt_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited', evidence_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL, completed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS memory_capsules(
        id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
        title TEXT NOT NULL, deliver_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
        revision INTEGER NOT NULL DEFAULT 1, error TEXT, approved_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS memory_walks(
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'paused',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_walk_items(
        walk_id TEXT NOT NULL REFERENCES memory_walks(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL, PRIMARY KEY(walk_id,source_id)
      );
      CREATE TABLE IF NOT EXISTS companion_sessions(
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
        person_id TEXT NOT NULL REFERENCES people(id), started_at INTEGER NOT NULL,
        ended_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS companion_jobs(
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
        source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        source_revision INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER,
        run_after INTEGER NOT NULL, error TEXT, created_at INTEGER NOT NULL,
        provider TEXT, model TEXT
      );
      CREATE INDEX IF NOT EXISTS companion_jobs_ready ON companion_jobs(status,run_after);
      CREATE INDEX IF NOT EXISTS capsules_due ON memory_capsules(status,deliver_at);
      CREATE INDEX IF NOT EXISTS connection_actor ON connection_events(actor_id,peer_id,happened_at);
      CREATE INDEX IF NOT EXISTS memory_anniversary_member ON memory_anniversary_notices(member_id,dismissed_at,created_at);
      INSERT OR IGNORE INTO migrations VALUES(2,${Date.now()});
      INSERT OR IGNORE INTO migrations VALUES(6,${Date.now()});
    `);
  })();
  const preferenceColumns = db.prepare("PRAGMA table_info(companion_preferences)").all() as { name: string }[];
  if (!preferenceColumns.some(column => column.name === "memory_reminders"))
    db.exec("ALTER TABLE companion_preferences ADD COLUMN memory_reminders INTEGER NOT NULL DEFAULT 1");
  initializeRitualTables(db);
  initializePhotoTables(db);
}
