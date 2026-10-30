import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import * as schema from "@/lib/schema";

const databasePath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? ".data/openloop.db",
);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const globalDatabase = globalThis as typeof globalThis & {
  openLoopSqlite?: Database.Database;
};

const sqlite = globalDatabase.openLoopSqlite ?? new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    project TEXT NOT NULL,
    commitment_text TEXT NOT NULL,
    trigger_text TEXT NOT NULL,
    actor TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS commitments (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    project TEXT NOT NULL,
    title TEXT NOT NULL,
    trigger_text TEXT NOT NULL,
    actor TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS evidence_evaluations (
    id TEXT PRIMARY KEY,
    commitment_id TEXT NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skill_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    allowed_sources_json TEXT NOT NULL,
    allowed_tools_json TEXT NOT NULL,
    approval_policy TEXT NOT NULL,
    version INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS action_proposals (
    id TEXT PRIMARY KEY,
    commitment_id TEXT NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skill_definitions(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    approved_at INTEGER,
    executed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deletion_tombstones (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    deleted_at INTEGER NOT NULL
  );
`);

if (process.env.NODE_ENV !== "production") {
  globalDatabase.openLoopSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
