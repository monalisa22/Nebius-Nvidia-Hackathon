import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const candidates = sqliteTable("candidates", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  project: text("project").notNull(),
  commitmentText: text("commitment_text").notNull(),
  triggerText: text("trigger_text").notNull(),
  actor: text("actor").notNull(),
  sourceQuote: text("source_quote").notNull(),
  confidence: real("confidence").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const commitments = sqliteTable("commitments", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  project: text("project").notNull(),
  title: text("title").notNull(),
  triggerText: text("trigger_text").notNull(),
  actor: text("actor").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const evidenceEvaluations = sqliteTable("evidence_evaluations", {
  id: text("id").primaryKey(),
  commitmentId: text("commitment_id")
    .notNull()
    .references(() => commitments.id, { onDelete: "cascade" }),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  outcome: text("outcome").notNull(),
  explanation: text("explanation").notNull(),
  sourceQuote: text("source_quote").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const skillDefinitions = sqliteTable("skill_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  allowedSourcesJson: text("allowed_sources_json").notNull(),
  allowedToolsJson: text("allowed_tools_json").notNull(),
  approvalPolicy: text("approval_policy").notNull(),
  version: integer("version").notNull(),
});

export const actionProposals = sqliteTable("action_proposals", {
  id: text("id").primaryKey(),
  commitmentId: text("commitment_id")
    .notNull()
    .references(() => commitments.id, { onDelete: "cascade" }),
  skillId: text("skill_id")
    .notNull()
    .references(() => skillDefinitions.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  approvedAt: integer("approved_at"),
  executedAt: integer("executed_at"),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  metadataJson: text("metadata_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const deletionTombstones = sqliteTable("deletion_tombstones", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  deletedAt: integer("deleted_at").notNull(),
});
