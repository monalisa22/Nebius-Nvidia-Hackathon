import type Database from "better-sqlite3";

export function initializeRitualTables(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS connection_rituals(
        id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        skill TEXT NOT NULL, source_ids TEXT NOT NULL, cadence TEXT NOT NULL,
        allow_action INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
        revision INTEGER NOT NULL DEFAULT 1, expires_at INTEGER, next_run_at INTEGER, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ritual_runs(
        id TEXT PRIMARY KEY, ritual_id TEXT NOT NULL REFERENCES connection_rituals(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, fingerprint TEXT, status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER,
        run_after INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        error TEXT, result TEXT, receipt TEXT NOT NULL DEFAULT '[]', provider TEXT, model TEXT, outcome_id TEXT
      );
      CREATE TABLE IF NOT EXISTS ritual_sources(
        run_id TEXT NOT NULL REFERENCES ritual_runs(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, PRIMARY KEY(run_id,source_id)
      );
      CREATE INDEX IF NOT EXISTS ritual_runs_ready ON ritual_runs(status,run_after);
      CREATE INDEX IF NOT EXISTS ritual_sources_memory ON ritual_sources(source_id);
      CREATE INDEX IF NOT EXISTS ritual_owner ON connection_rituals(member_id);
      CREATE UNIQUE INDEX IF NOT EXISTS ritual_one_pending ON ritual_runs(ritual_id)
        WHERE status IN ('queued','running');

      -- Remove derived text in the same transaction as a source or permission change.
      CREATE TRIGGER IF NOT EXISTS ritual_memory_update AFTER UPDATE ON memories BEGIN
        UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL
          WHERE id IN (SELECT run_id FROM ritual_sources WHERE source_id=OLD.id);
      END;
      CREATE TRIGGER IF NOT EXISTS ritual_memory_delete BEFORE DELETE ON memories BEGIN
        UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL
          WHERE id IN (SELECT run_id FROM ritual_sources WHERE source_id=OLD.id);
      END;
      CREATE TRIGGER IF NOT EXISTS ritual_family_change AFTER UPDATE OF revision,cloud_consent ON families BEGIN
        UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL
          WHERE ritual_id IN (SELECT r.id FROM connection_rituals r JOIN members m ON m.id=r.member_id WHERE m.family_id=NEW.id)
          AND status IN ('queued','running','ready','applied');
      END;
      INSERT OR IGNORE INTO migrations VALUES(3,${Date.now()});
    `);
    const columns = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
    if (!columns("connection_rituals").includes("engine")) {
      db.exec(`ALTER TABLE connection_rituals ADD COLUMN engine TEXT NOT NULL DEFAULT 'direct';
        ALTER TABLE connection_rituals ADD COLUMN skill_config TEXT NOT NULL DEFAULT '{"maxMoments":3,"questionCount":2,"focus":"mixed","tone":"simple"}';`);
    }
    if (!columns("ritual_runs").includes("task")) {
      db.exec(`ALTER TABLE ritual_runs ADD COLUMN task TEXT NOT NULL DEFAULT 'prepare';
        ALTER TABLE ritual_runs ADD COLUMN instruction TEXT;
        ALTER TABLE ritual_runs ADD COLUMN skill_proposal TEXT;`);
    }
    if (!columns("ritual_runs").includes("trigger_key")) db.exec("ALTER TABLE ritual_runs ADD COLUMN trigger_key TEXT;");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ritual_trigger_unique ON ritual_runs(ritual_id,trigger_key) WHERE trigger_key IS NOT NULL;");
    // A proposal is private derived data too, and must follow the result's lifecycle.
    db.exec(`CREATE TRIGGER IF NOT EXISTS ritual_proposal_expiry AFTER UPDATE OF status ON ritual_runs
      WHEN NEW.status IN ('expired','dismissed','cancelled') BEGIN
        UPDATE ritual_runs SET skill_proposal=NULL,instruction=NULL WHERE id=NEW.id;
      END;
      INSERT OR IGNORE INTO migrations VALUES(4,${Date.now()});`);
  })();
}
