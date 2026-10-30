import type Database from "better-sqlite3";

export function initializePhotoTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_permissions(
      family_id TEXT PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS photo_analyses(
      id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      source_revision INTEGER NOT NULL, media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued', revision INTEGER NOT NULL DEFAULT 1,
      attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER,
      result TEXT, reviewed TEXT, provider TEXT, model TEXT, error TEXT, created_at INTEGER NOT NULL,
      UNIQUE(source_id,source_revision)
    );
    CREATE INDEX IF NOT EXISTS photo_jobs_ready ON photo_analyses(status,created_at);
    CREATE TRIGGER IF NOT EXISTS photo_source_update AFTER UPDATE OF revision ON memories BEGIN
      DELETE FROM photo_analyses WHERE source_id=NEW.id;
    END;
    CREATE TRIGGER IF NOT EXISTS photo_evidence_delete BEFORE DELETE ON photo_analyses BEGIN
      DELETE FROM artifacts WHERE id IN (SELECT artifact_id FROM artifact_sources WHERE source_id=OLD.source_id);
      UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL
        WHERE id IN (SELECT run_id FROM ritual_sources WHERE source_id=OLD.source_id);
    END;
    CREATE TRIGGER IF NOT EXISTS photo_cloud_revoked AFTER UPDATE OF cloud_consent ON families
      WHEN NEW.cloud_consent=0 BEGIN
        DELETE FROM photo_analyses WHERE family_id=NEW.id;
        UPDATE photo_permissions SET enabled=0 WHERE family_id=NEW.id;
      END;
    INSERT OR IGNORE INTO migrations VALUES(5,${Date.now()});
  `);
}
