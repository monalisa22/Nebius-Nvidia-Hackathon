import Database from "better-sqlite3";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initializeCompanionTables } from "../togetherly/schema";
import { relationshipLabel, type FamilyLink } from "./relationships";
import { approvedPhotoEvidence, resolveMemoryQuote } from "../togetherly/photo-evidence";
import type {
  Artifact,
  BriefContent,
  Call,
  Family,
  Job,
  Member,
  Memory,
  Message,
  Person,
  Receipt,
} from "./types";

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AnubandhError";
  }
}
// Next.js route bundles may hold different constructors while sharing the store.
export function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof Error &&
    error.name === "AnubandhError" &&
    "status" in error &&
    typeof error.status === "number"
  );
}
export const id = () => randomUUID();
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const digest = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}
const memberColumns =
  "id,family_id,email,name,relationship,role,active,can_view,can_contribute,can_schedule,expires_at,person_id,created_at";

export class FamilyStore {
  readonly db: Database.Database;
  constructor(filename: string) {
    if (filename !== ":memory:")
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,name TEXT NOT NULL,primary_name TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',briefing_hour INTEGER NOT NULL DEFAULT 8,cloud_consent INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,is_demo INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,name TEXT NOT NULL,relationship TEXT NOT NULL,about TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,relationship TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,can_view INTEGER NOT NULL DEFAULT 1,can_contribute INTEGER NOT NULL DEFAULT 1,can_schedule INTEGER NOT NULL DEFAULT 0,expires_at INTEGER,person_id TEXT REFERENCES people(id) ON DELETE SET NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,name TEXT NOT NULL,relationship TEXT NOT NULL,can_view INTEGER NOT NULL,can_contribute INTEGER NOT NULL,can_schedule INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES members(id),mime TEXT NOT NULL,filename TEXT NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES members(id),title TEXT NOT NULL,caption TEXT NOT NULL,kind TEXT NOT NULL,person_ids TEXT NOT NULL DEFAULT '[]',audience TEXT NOT NULL DEFAULT '["*"]',status TEXT NOT NULL DEFAULT 'pending',media_id TEXT REFERENCES media(id) ON DELETE SET NULL,expires_at INTEGER,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,scheduled_at INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'scheduled',created_by TEXT NOT NULL REFERENCES members(id));
      CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id),kind TEXT NOT NULL,call_id TEXT REFERENCES calls(id) ON DELETE CASCADE,content TEXT NOT NULL,provider TEXT NOT NULL,model TEXT,language TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS artifact_sources(artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,revision INTEGER NOT NULL,PRIMARY KEY(artifact_id,source_id));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id),kind TEXT NOT NULL,call_id TEXT REFERENCES calls(id) ON DELETE CASCADE,dedupe TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,run_after INTEGER NOT NULL,lease_until INTEGER,lease_token TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,sender_id TEXT NOT NULL REFERENCES members(id),recipient_id TEXT NOT NULL REFERENCES members(id),text TEXT NOT NULL DEFAULT '',media_id TEXT REFERENCES media(id) ON DELETE SET NULL,status TEXT NOT NULL DEFAULT 'draft',revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,delivered_at INTEGER);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,actor_id TEXT,kind TEXT NOT NULL,summary TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS throttle(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS memories_family ON memories(family_id,status,created_at);
      CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(status,run_after);
      CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient_id,status);
      INSERT OR IGNORE INTO migrations VALUES(1,${Date.now()});
    `);
    initializeCompanionTables(this.db);
  }
  one<T>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  all<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }
  run(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
  audit(
    member: Pick<Member, "id" | "family_id">,
    kind: string,
    summary: string,
  ) {
    this.run(
      "INSERT INTO receipts VALUES(?,?,?,?,?,?)",
      id(),
      member.family_id,
      member.id,
      kind,
      summary,
      Date.now(),
    );
  }
  family(familyId: string): Family {
    const row = this.one<Family>("SELECT * FROM families WHERE id=?", familyId);
    if (!row) throw new DomainError("Family not found.", 404);
    return row;
  }
  member(memberId: string): Member {
    const row = this.one<Member>(
      `SELECT ${memberColumns} FROM members WHERE id=?`,
      memberId,
    );
    if (!row || !row.active || (row.expires_at && row.expires_at <= Date.now()))
      throw new DomainError(
        "Your access has ended. Please sign in again.",
        401,
      );
    return row;
  }
  primary(member: Member) {
    if (this.member(member.id).role !== "primary")
      throw new DomainError("Only the primary user can make this change.", 403);
  }
  bump(familyId: string) {
    this.run("UPDATE families SET revision=revision+1 WHERE id=?", familyId);
  }
  throttle(key: string, limit = 8, windowMs = 900_000) {
    const now = Date.now();
    this.run("DELETE FROM throttle WHERE reset_at<?", now);
    const entry = this.one<{ attempts: number }>(
      "SELECT attempts FROM throttle WHERE key=?",
      hash(key),
    );
    if (entry && entry.attempts >= limit)
      throw new DomainError("Too many attempts. Please try again later.", 429);
    this.run(
      "INSERT INTO throttle VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1",
      hash(key),
      now + windowMs,
    );
  }
  createFamily(
    input: {
      name: string;
      email: string;
      password: string;
      familyName: string;
    },
    demo = false,
  ) {
    const familyId = id();
    const memberId = id();
    const now = Date.now();
    if (
      this.one(
        "SELECT id FROM members WHERE email=?",
        input.email.toLowerCase(),
      )
    )
      throw new DomainError(
        "This email already has an account. Please sign in.",
      );
    const digest = passwordHash(input.password);
    this.transaction(() => {
      this.run(
        "INSERT INTO families(id,name,primary_name,is_demo,created_at) VALUES(?,?,?,?,?)",
        familyId,
        input.familyName,
        input.name,
        Number(demo),
        now,
      );
      this.run(
        "INSERT INTO members(id,family_id,email,name,relationship,role,password_hash,can_schedule,created_at) VALUES(?,?,?,?,?,'primary',?,1,?)",
        memberId,
        familyId,
        input.email.toLowerCase(),
        input.name,
        "You",
        digest,
        now,
      );
    });
    return this.member(memberId);
  }
  login(email: string, password: string) {
    this.throttle(`login:${email.toLowerCase()}`);
    const row = this.one<{ id: string; password_hash: string }>(
      "SELECT id,password_hash FROM members WHERE email=?",
      email.toLowerCase(),
    );
    if (!row || !passwordMatches(password, row.password_hash))
      throw new DomainError("Email or password is incorrect.", 401);
    return this.member(row.id);
  }
  newSession(memberId: string) {
    const token = randomBytes(32).toString("hex");
    this.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      memberId,
      Date.now() + 7 * 86400000,
    );
    return token;
  }
  session(token: string) {
    const row = this.one<{ member_id: string }>(
      "SELECT member_id FROM sessions WHERE id=? AND expires_at>?",
      hash(token),
      Date.now(),
    );
    return row ? this.member(row.member_id) : null;
  }
  revokeSession(token: string) {
    this.run("DELETE FROM sessions WHERE id=?", hash(token));
  }
  people(member: Member) {
    this.member(member.id);
    return this.all<Person>(
      "SELECT * FROM people WHERE family_id=? ORDER BY name",
      member.family_id,
    );
  }
  addPerson(
    member: Member,
    input: { name: string; relationship: string; about: string },
  ) {
    this.primary(member);
    const personId = id();
    this.run(
      "INSERT INTO people VALUES(?,?,?,?,?,'')",
      personId,
      member.family_id,
      input.name,
      input.relationship,
      input.about,
    );
    this.bump(member.family_id);
    return personId;
  }
  editPerson(
    member: Member,
    personId: string,
    input: { name: string; relationship: string; about: string },
  ) {
    this.primary(member);
    if (!this.people(member).some((p) => p.id === personId))
      throw new DomainError("Person not found.", 404);
    this.transaction(() => {
      this.run(
        "UPDATE people SET name=?,relationship=?,about=? WHERE id=? AND family_id=?",
        input.name,
        input.relationship,
        input.about,
        personId,
        member.family_id,
      );
      this.run(
        "UPDATE members SET name=?,relationship=? WHERE person_id=? AND family_id=?",
        input.name,
        input.relationship,
        personId,
        member.family_id,
      );
      this.run("DELETE FROM artifacts WHERE family_id=?", member.family_id);
      this.bump(member.family_id);
      this.audit(
        member,
        "person_corrected",
        "A family profile was corrected; dependent briefs were removed.",
      );
    });
  }
  members(member: Member) {
    return this.all<Member>(
      `SELECT ${memberColumns} FROM members WHERE family_id=? ORDER BY created_at`,
      member.family_id,
    );
  }
  canRead(member: Member, memory: Memory) {
    if (
      memory.family_id !== member.family_id ||
      (memory.expires_at && memory.expires_at <= Date.now())
    )
      return false;
    if (member.role === "primary" || memory.author_id === member.id)
      return true;
    const audience: string[] = JSON.parse(memory.audience);
    return Boolean(
      member.can_view &&
      memory.status === "approved" &&
      (audience.includes("*") || audience.includes(member.id)),
    );
  }
  memories(member: Member, approvedOnly = false) {
    const fresh = this.member(member.id);
    return this.all<Memory>(
      "SELECT m.*,u.name AS author_name FROM memories m JOIN members u ON u.id=m.author_id WHERE m.family_id=? ORDER BY m.created_at DESC LIMIT 500",
      member.family_id,
    ).filter(
      (m) =>
        this.canRead(fresh, m) && (!approvedOnly || m.status === "approved"),
    );
  }
  memory(member: Member, memoryId: string) {
    const fresh = this.member(member.id);
    const row = this.one<Memory>("SELECT * FROM memories WHERE id=?", memoryId);
    if (!row || !this.canRead(fresh, row))
      throw new DomainError("This memory is not available.", 404);
    return row;
  }
  addMemory(
    member: Member,
    input: {
      title: string;
      caption: string;
      kind: Memory["kind"];
      personIds: string[];
      audience: string[];
      mediaId?: string | null;
      expiresAt?: number | null;
    },
  ) {
    const fresh = this.member(member.id);
    if (!fresh.can_contribute && fresh.role !== "primary")
      throw new DomainError("You do not have permission to contribute.", 403);
    if (input.kind !== "photo" && !input.caption.trim()) throw new DomainError("Add the known details in a caption.");
    if (
      this.one<{ n: number }>(
        "SELECT COUNT(*) n FROM memories WHERE family_id=?",
        member.family_id,
      )!.n >= 500
    )
      throw new DomainError("This workspace has reached its 500-memory limit.");
    const people = this.people(member);
    if (input.personIds.some((p) => !people.some((person) => person.id === p)))
      throw new DomainError("Choose people from your family.");
    if (
      input.audience.some(
        (a) => a !== "*" && !this.members(member).some((m) => m.id === a),
      )
    )
      throw new DomainError("Invalid sharing selection.");
    if (input.mediaId) {
      const media = this.ownedMedia(member, input.mediaId);
      if (
        this.one("SELECT id FROM memories WHERE media_id=?", input.mediaId) ||
        this.one("SELECT id FROM messages WHERE media_id=?", input.mediaId)
      )
        throw new DomainError("This attachment is already in use.");
      if (
        (input.kind === "photo" && !media.mime.startsWith("image/")) ||
        (input.kind === "voice" && !media.mime.startsWith("audio/"))
      )
        throw new DomainError("Choose the matching photo or audio format.");
    }
    if ((input.kind === "photo" || input.kind === "voice") && !input.mediaId)
      throw new DomainError("This contribution needs its photo or recording.");
    const memoryId = id();
    const now = Date.now();
    this.transaction(() => {
      this.run(
        "INSERT INTO memories(id,family_id,author_id,title,caption,kind,person_ids,audience,media_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        memoryId,
        member.family_id,
        member.id,
        input.title,
        input.caption,
        input.kind,
        JSON.stringify(input.personIds),
        JSON.stringify(input.audience),
        input.mediaId ?? null,
        input.expiresAt ?? null,
        now,
        now,
      );
      this.audit(
        member,
        "contribution_added",
        "A contribution was added for review.",
      );
    });
    return memoryId;
  }
  invalidate(memoryId: string) {
    this.run("DELETE FROM person_facts WHERE source_id=?", memoryId);
    this.run(
      "DELETE FROM artifacts WHERE id IN (SELECT artifact_id FROM artifact_sources WHERE source_id=?)",
      memoryId,
    );
  }
  reviewMemory(
    member: Member,
    memoryId: string,
    decision: "approved" | "rejected",
    revision: number,
  ) {
    this.primary(member);
    const memory = this.memory(member, memoryId);
    if (memory.revision !== revision)
      throw new DomainError(
        "This memory changed. Reopen it before reviewing.",
        409,
      );
    this.transaction(() => {
      this.run(
        "UPDATE memories SET status=?,revision=revision+1,updated_at=? WHERE id=?",
        decision,
        Date.now(),
        memoryId,
      );
      this.invalidate(memoryId);
      this.bump(member.family_id);
      this.audit(
        member,
        `memory_${decision}`,
        decision === "approved"
          ? "A memory was approved for family assistance."
          : "A contribution was declined.",
      );
    });
  }
  editMemory(
    member: Member,
    memoryId: string,
    revision: number,
    title: string,
    caption: string,
    expiresAt: number | null,
    audience: string[],
    personIds?: string[],
  ) {
    this.primary(member);
    const memory = this.memory(member, memoryId);
    if (memory.kind !== "photo" && !caption.trim()) throw new DomainError("Add the known details in a caption.");
    if (memory.revision !== revision)
      throw new DomainError(
        "This memory changed. Reopen it before editing.",
        409,
      );
    if (
      audience.some(
        (a) => a !== "*" && !this.members(member).some((m) => m.id === a),
      )
    )
      throw new DomainError("Invalid sharing selection.");
    const people = personIds ?? (JSON.parse(memory.person_ids) as string[]);
    if (
      people.some((p) => !this.people(member).some((person) => person.id === p))
    )
      throw new DomainError("Choose people from this family.");
    this.transaction(() => {
      this.run(
        "UPDATE memories SET title=?,caption=?,expires_at=?,audience=?,person_ids=?,revision=revision+1,updated_at=? WHERE id=?",
        title,
        caption,
        expiresAt,
        JSON.stringify(audience),
        JSON.stringify(people),
        Date.now(),
        memoryId,
      );
      this.invalidate(memoryId);
      this.bump(member.family_id);
      this.audit(
        member,
        "memory_corrected",
        "A memory was corrected; dependent briefs were removed.",
      );
    });
  }
  deleteMemory(member: Member, memoryId: string) {
    this.primary(member);
    const memory = this.memory(member, memoryId);
    this.transaction(() => {
      this.invalidate(memoryId);
      this.run("DELETE FROM memories WHERE id=?", memoryId);
      if (memory.media_id)
        this.run("DELETE FROM media WHERE id=?", memory.media_id);
      this.bump(member.family_id);
      this.audit(
        member,
        "memory_deleted",
        "A memory and its dependent briefs were removed.",
      );
    });
    return memory.media_id;
  }
  ownedMedia(member: Member, mediaId: string) {
    const row = this.one<{
      id: string;
      family_id: string;
      owner_id: string;
      mime: string;
      filename: string;
      bytes: number;
    }>(
      "SELECT * FROM media WHERE id=? AND family_id=? AND owner_id=?",
      mediaId,
      member.family_id,
      member.id,
    );
    if (!row) throw new DomainError("Recording or photo not found.", 404);
    return row;
  }
  media(member: Member, mediaId: string) {
    const fresh = this.member(member.id);
    const row = this.one<{
      id: string;
      family_id: string;
      owner_id: string;
      mime: string;
      filename: string;
      bytes: number;
    }>(
      "SELECT * FROM media WHERE id=? AND family_id=?",
      mediaId,
      member.family_id,
    );
    if (!row) throw new DomainError("Media not available.", 404);
    const source = this.one<Memory>(
      "SELECT * FROM memories WHERE media_id=?",
      mediaId,
    );
    const message = this.one<Message>(
      "SELECT * FROM messages WHERE media_id=?",
      mediaId,
    );
    const allowed = source
      ? this.canRead(fresh, source)
      : message
        ? message.sender_id === member.id ||
          (message.recipient_id === member.id && message.status !== "draft")
        : row.owner_id === member.id;
    if (!allowed) throw new DomainError("Media not available.", 404);
    return row;
  }
  saveMedia(member: Member, mime: string, bytes: number) {
    this.member(member.id);
    const used = this.one<{ total: number }>(
      "SELECT COALESCE(SUM(bytes),0) total FROM media WHERE family_id=?",
      member.family_id,
    )!.total;
    if (used + bytes > 100 * 1024 * 1024)
      throw new DomainError("Family storage limit reached (100 MB).");
    const mediaId = id();
    this.run(
      "INSERT INTO media VALUES(?,?,?,?,?,?,?)",
      mediaId,
      member.family_id,
      member.id,
      mime,
      mediaId,
      bytes,
      Date.now(),
    );
    return mediaId;
  }
  invite(
    member: Member,
    input: {
      name: string;
      relationship: string;
      view: boolean;
      contribute: boolean;
      schedule: boolean;
    },
  ) {
    this.primary(member);
    this.throttle(`invite:${member.family_id}`, 20, 86400000);
    const token = randomBytes(24).toString("hex");
    this.run(
      "INSERT INTO invites VALUES(?,?,?,?,?,?,?,?,?,NULL)",
      id(),
      member.family_id,
      hash(token),
      input.name,
      input.relationship,
      Number(input.view),
      Number(input.contribute),
      Number(input.schedule),
      Date.now() + 7 * 86400000,
    );
    return token;
  }
  inviteInfo(token: string) {
    return this.one<{
      name: string;
      relationship: string;
      family_id: string;
      can_view: number;
      can_contribute: number;
      can_schedule: number;
      expires_at: number;
    }>(
      "SELECT * FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
      hash(token),
      Date.now(),
    );
  }
  join(token: string, email: string, password: string) {
    const invitation = this.inviteInfo(token);
    if (!invitation)
      throw new DomainError("This invitation has expired or was already used.");
    if (this.one("SELECT id FROM members WHERE email=?", email.toLowerCase()))
      throw new DomainError("This email already has an account.");
    const memberId = id();
    const personId = id();
    const digest = passwordHash(password);
    this.transaction(() => {
      const changed = this.run(
        "UPDATE invites SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
        Date.now(),
        hash(token),
        Date.now(),
      );
      if (!changed.changes)
        throw new DomainError("This invitation was already used.", 409);
      this.run(
        "INSERT INTO people VALUES(?,?,?,?,?,'')",
        personId,
        invitation.family_id,
        invitation.name,
        invitation.relationship,
        "",
      );
      this.run(
        "INSERT INTO members(id,family_id,email,name,relationship,role,password_hash,can_view,can_contribute,can_schedule,person_id,created_at) VALUES(?,?,?,?,?,'relative',?,?,?,?,?,?)",
        memberId,
        invitation.family_id,
        email.toLowerCase(),
        invitation.name,
        invitation.relationship,
        digest,
        invitation.can_view,
        invitation.can_contribute,
        invitation.can_schedule,
        personId,
        Date.now(),
      );
      this.bump(invitation.family_id);
    });
    return this.member(memberId);
  }
  setAccess(
    member: Member,
    memberId: string,
    input: {
      active: boolean;
      view: boolean;
      contribute: boolean;
      schedule: boolean;
      expiresAt: number | null;
    },
  ) {
    this.primary(member);
    const target = this.one<Member>(
      "SELECT * FROM members WHERE id=? AND family_id=? AND role='relative'",
      memberId,
      member.family_id,
    );
    if (!target) throw new DomainError("Relative not found.", 404);
    this.transaction(() => {
      this.run(
        "UPDATE members SET active=?,can_view=?,can_contribute=?,can_schedule=?,expires_at=? WHERE id=?",
        Number(input.active),
        Number(input.view),
        Number(input.contribute),
        Number(input.schedule),
        input.expiresAt,
        memberId,
      );
      if (!input.active)
        this.run("DELETE FROM sessions WHERE member_id=?", memberId);
      this.run("DELETE FROM artifacts WHERE member_id=?", memberId);
      this.bump(member.family_id);
      this.audit(
        member,
        "access_changed",
        "A family member's access was updated.",
      );
    });
  }
  settings(
    member: Member,
    input: {
      language: "en" | "hi";
      timezone: string;
      hour: number;
      cloud: boolean;
    },
  ) {
    this.primary(member);
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone });
    } catch {
      throw new DomainError("Choose a valid time zone.");
    }
    this.transaction(() => {
      this.run(
        "UPDATE families SET language=?,timezone=?,briefing_hour=?,cloud_consent=?,revision=revision+1 WHERE id=?",
        input.language,
        input.timezone,
        input.hour,
        Number(input.cloud),
        member.family_id,
      );
      this.run("DELETE FROM artifacts WHERE family_id=?", member.family_id);
      if (!input.cloud)
        this.run(
          "UPDATE jobs SET status='cancelled',updated_at=? WHERE family_id=? AND status IN ('queued','running')",
          Date.now(),
          member.family_id,
        );
      this.audit(
        member,
        "preferences_updated",
        input.cloud
          ? "Briefing preferences and cloud processing permission updated."
          : "Cloud processing permission withdrawn. Pending jobs cancelled.",
      );
    });
  }
  scheduleCall(
    member: Member,
    personId: string,
    scheduledAt: number,
    note: string,
  ) {
    const fresh = this.member(member.id);
    if (fresh.role !== "primary" && !fresh.can_schedule)
      throw new DomainError("You cannot schedule calls.", 403);
    if (!this.people(member).some((p) => p.id === personId))
      throw new DomainError("Choose a family contact.");
    const callId = id();
    this.run(
      "INSERT INTO calls VALUES(?,?,?,?,?,'scheduled',?)",
      callId,
      member.family_id,
      personId,
      scheduledAt,
      note,
      member.id,
    );
    this.audit(member, "call_scheduled", "A family call was scheduled.");
    return callId;
  }
  cancelCall(member: Member, callId: string) {
    const call = this.one<Call>(
      "SELECT * FROM calls WHERE id=? AND family_id=?",
      callId,
      member.family_id,
    );
    if (!call || (member.role !== "primary" && call.created_by !== member.id))
      throw new DomainError("Call not available.", 404);
    this.run("UPDATE calls SET status='cancelled' WHERE id=?", callId);
    this.run("DELETE FROM artifacts WHERE call_id=?", callId);
    this.run(
      "UPDATE jobs SET status='cancelled' WHERE call_id=? AND status IN ('queued','running')",
      callId,
    );
  }
  calls(member: Member) {
    return this.all<Call>(
      "SELECT * FROM calls WHERE family_id=? AND status='scheduled' ORDER BY scheduled_at LIMIT 100",
      member.family_id,
    ).filter(
      (c) =>
        member.role === "primary" ||
        member.can_view ||
        c.created_by === member.id,
    );
  }
  createMessage(
    member: Member,
    recipientId: string,
    text: string,
    mediaId: string | null,
  ) {
    this.member(member.id);
    this.throttle(`message:${member.id}`, 60, 3600000);
    const recipient = this.member(recipientId);
    if (recipient.family_id !== member.family_id || recipient.id === member.id)
      throw new DomainError("Choose an available family recipient.");
    if (mediaId) {
      const media = this.ownedMedia(member, mediaId);
      if (!media.mime.startsWith("audio/"))
        throw new DomainError("A voice reply must use an audio recording.");
      if (
        this.one("SELECT id FROM memories WHERE media_id=?", mediaId) ||
        this.one("SELECT id FROM messages WHERE media_id=?", mediaId)
      )
        throw new DomainError("This recording is already in use.");
    }
    if (!text.trim() && !mediaId)
      throw new DomainError("Record a reply or write a message first.");
    const messageId = id();
    this.run(
      "INSERT INTO messages(id,family_id,sender_id,recipient_id,text,media_id,status,created_at) VALUES(?,?,?,?,?,?,'draft',?)",
      messageId,
      member.family_id,
      member.id,
      recipientId,
      text,
      mediaId,
      Date.now(),
    );
    return messageId;
  }
  sendMessage(member: Member, messageId: string, revision: number, capsuleDelivery = false) {
    this.member(member.id);
    return this.transaction(() => {
      const message = this.one<Message>(
        "SELECT * FROM messages WHERE id=? AND sender_id=? AND family_id=?",
        messageId,
        member.id,
        member.family_id,
      );
      if (!message) throw new DomainError("Reply not found.", 404);
      const capsule = this.one<{ status: string; deliver_at: number }>(
        "SELECT status,deliver_at FROM memory_capsules WHERE message_id=?", messageId,
      );
      if (capsule && message.status === "draft" &&
          (!capsuleDelivery || capsule.status !== "scheduled" || capsule.deliver_at > Date.now()))
        throw new DomainError("This is a future capsule. Approve or change its delivery in For later.", 409);
      if (message.revision !== revision)
        throw new DomainError(
          "The reply changed. Please review it again.",
          409,
        );
      this.member(message.recipient_id);
      if (message.status !== "draft") return;
      this.run(
        "UPDATE messages SET status='delivered',delivered_at=? WHERE id=? AND status='draft'",
        Date.now(),
        messageId,
      );
      this.audit(
        member,
        "reply_delivered",
        "An approved reply was delivered to the selected private family inbox.",
      );
    });
  }
  deleteMessage(member: Member, messageId: string) {
    const message = this.one<Message>(
      "SELECT * FROM messages WHERE id=? AND sender_id=?",
      messageId,
      member.id,
    );
    if (!message) throw new DomainError("Reply not found.", 404);
    this.run("DELETE FROM messages WHERE id=?", messageId);
    if (message.media_id)
      this.run("DELETE FROM media WHERE id=?", message.media_id);
    return message.media_id;
  }
  openMessage(member: Member, messageId: string) {
    this.run(
      "UPDATE messages SET status='opened' WHERE id=? AND recipient_id=? AND status='delivered'",
      messageId,
      member.id,
    );
  }
  messages(member: Member) {
    return this.all<Message>(
      "SELECT m.*,s.name sender_name,r.name recipient_name FROM messages m JOIN members s ON s.id=m.sender_id JOIN members r ON r.id=m.recipient_id WHERE m.family_id=? AND (m.sender_id=? OR (m.recipient_id=? AND m.status!='draft')) ORDER BY m.created_at DESC LIMIT 100",
      member.family_id,
      member.id,
      member.id,
    );
  }
  queue(
    member: Member,
    kind: "briefing" | "call",
    callId: string | null,
    dedupe?: string,
  ) {
    this.member(member.id);
    const family = this.family(member.family_id);
    if (!family.cloud_consent)
      throw new DomainError(
        "The primary user must allow AI processing in My choices first.",
        403,
      );
    if (member.role !== "primary" && !member.can_view)
      throw new DomainError("You cannot prepare family briefings.", 403);
    if (callId && !this.calls(member).some((c) => c.id === callId))
      throw new DomainError("Call not found.", 404);
    if (kind === "call" && !callId)
      throw new DomainError("Select a call first.");
    const existing = this.one<Job>(
      "SELECT * FROM jobs WHERE member_id=? AND kind=? AND COALESCE(call_id,'')=COALESCE(?,'') AND status IN ('queued','running')",
      member.id,
      kind,
      callId,
    );
    if (existing) return existing.id;
    if (!dedupe) this.throttle(`ai:${member.family_id}`, 30, 3600000);
    const jobId = id();
    const now = Date.now();
    this.run(
      "INSERT OR IGNORE INTO jobs(id,family_id,member_id,kind,call_id,dedupe,run_after,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      jobId,
      member.family_id,
      member.id,
      kind,
      callId,
      dedupe ?? id(),
      now,
      now,
      now,
    );
    return jobId;
  }
  jobAction(member: Member, jobId: string, action: "retry" | "cancel") {
    const job = this.one<Job>(
      "SELECT * FROM jobs WHERE id=? AND member_id=?",
      jobId,
      member.id,
    );
    if (!job) throw new DomainError("Job not found.", 404);
    if (action === "cancel")
      this.run(
        "UPDATE jobs SET status='cancelled',updated_at=? WHERE id=? AND status IN ('queued','running')",
        Date.now(),
        jobId,
      );
    else if (job.status === "failed" || job.status === "cancelled") {
      if (!this.family(member.family_id).cloud_consent)
        throw new DomainError("AI permission is disabled.", 403);
      this.throttle(`ai:${member.family_id}`, 30, 3600000);
      this.run(
        "UPDATE jobs SET status='queued',attempts=0,error=NULL,run_after=?,updated_at=? WHERE id=?",
        Date.now(),
        Date.now(),
        jobId,
      );
    }
  }
  claimJob() {
    return this.transaction(() => {
      const now = Date.now();
      this.run(
        "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Processing was interrupted. Please retry if needed.' WHERE status='running' AND lease_until<?",
        now,
      );
      const job = this.one<Job>(
        "SELECT * FROM jobs WHERE status='queued' AND run_after<=? ORDER BY created_at LIMIT 1",
        now,
      );
      if (!job) return null;
      const leaseToken = id();
      this.run(
        "UPDATE jobs SET status='running',attempts=attempts+1,lease_until=?,lease_token=?,updated_at=? WHERE id=?",
        now + 150000,
        leaseToken,
        now,
        job.id,
      );
      return { ...job, attempts: job.attempts + 1, leaseToken };
    });
  }
  context(job: Job) {
    const member = this.member(job.member_id);
    const family = this.family(job.family_id);
    if (!family.cloud_consent)
      throw new DomainError("AI permission was withdrawn.", 403);
    if (member.role !== "primary" && !member.can_view)
      throw new DomainError("Family access changed.", 403);
    const call = job.call_id
      ? this.calls(member).find((c) => c.id === job.call_id)
      : undefined;
    if (job.kind === "call" && !call)
      throw new DomainError("This call is no longer scheduled.");
    const person = call
      ? this.people(member).find((p) => p.id === call.person_id)
      : undefined;
    const sources = this.memories(member, true)
      .filter((m) => !person || JSON.parse(m.person_ids).includes(person.id))
      .map(m => ({ ...m, photoEvidence: approvedPhotoEvidence(this.db, m) }))
      .filter(m => m.caption.trim() || m.photoEvidence)
      .slice(0, 12);
    const relationships = this.relationshipContext(member);
    return {
      member,
      family,
      call,
      person,
      sources,
      people: relationships.people.map((p) => ({
        ...p,
        relationship_label: relationshipLabel(p, relationships),
      })),
      callPartner: person?.id === member.person_id
        ? this.members(member).find((m) => m.role === "primary")
        : person,
      relationships,
      fingerprint: hash(
        JSON.stringify({
          revision: family.revision,
          member,
          call,
          sources: sources.map((m) => [m.id, m.revision, m.photoEvidence]),
        }),
      ),
    };
  }
  commitJob(
    job: Job & { leaseToken: string },
    fingerprint: string,
    content: BriefContent,
    provider: string,
    model: string | null,
  ) {
    this.transaction(() => {
      const current = this.one<{ status: string; lease_token: string }>(
        "SELECT status,lease_token FROM jobs WHERE id=?",
        job.id,
      );
      if (
        current?.status !== "running" ||
        current.lease_token !== job.leaseToken
      )
        return;
      const context = this.context(job);
      if (context.fingerprint !== fingerprint)
        throw new DomainError(
          "The source or permission changed. Please generate a fresh brief.",
          409,
        );
      for (const item of content.items) {
        const source = context.sources.find((s) => s.id === item.sourceId);
        if (
          !source ||
          !item.quote.trim() ||
          resolveMemoryQuote(source, item.quote, item.evidenceId) !== item.quote
        )
          throw new DomainError(
            "The result did not match its approved sources.",
          );
      }
      const artifactId = id();
      this.run(
        "DELETE FROM artifacts WHERE member_id=? AND kind=? AND COALESCE(call_id,'')=COALESCE(?,'')",
        job.member_id,
        job.kind,
        job.call_id,
      );
      this.run(
        "INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?,?,?)",
        artifactId,
        job.family_id,
        job.member_id,
        job.kind,
        job.call_id,
        JSON.stringify(content),
        provider,
        model,
        context.family.language,
        Date.now(),
      );
      for (const sourceId of new Set(content.items.map((i) => i.sourceId)))
        this.run(
          "INSERT INTO artifact_sources VALUES(?,?,?)",
          artifactId,
          sourceId,
          context.sources.find((s) => s.id === sourceId)!.revision,
        );
      this.run(
        "UPDATE jobs SET status='completed',lease_until=NULL,error=NULL,updated_at=? WHERE id=?",
        Date.now(),
        job.id,
      );
      this.audit(
        context.member,
        "brief_prepared",
        `${job.kind === "call" ? "Call preparation" : "Family briefing"} prepared from ${content.items.length} approved source excerpts (${provider}).`,
      );
    });
  }
  failJob(
    job: Job & { leaseToken: string },
    message: string,
    retryable: boolean,
  ) {
    this.run(
      "UPDATE jobs SET status=?,error=?,run_after=?,lease_until=NULL,updated_at=? WHERE id=? AND status='running' AND lease_token=?",
      retryable && job.attempts < 3 ? "queued" : "failed",
      message,
      Date.now() + 30000 * job.attempts,
      Date.now(),
      job.id,
      job.leaseToken,
    );
  }
  artifacts(member: Member) {
    const readable = new Map(
      this.memories(member, true).map((m) => [m.id, m.revision]),
    );
    return this.all<Artifact>(
      "SELECT * FROM artifacts WHERE member_id=? ORDER BY created_at DESC LIMIT 20",
      member.id,
    ).filter((a) =>
      this.all<{ source_id: string; revision: number }>(
        "SELECT * FROM artifact_sources WHERE artifact_id=?",
        a.id,
      ).every((s) => readable.get(s.source_id) === s.revision),
    );
  }
  tick() {
    const now = Date.now();
    this.run(
      "INSERT INTO settings VALUES('heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      String(now),
    );
    const expired = this.all<{
      id: string;
      family_id: string;
      media_id: string | null;
    }>(
      "SELECT id,family_id,media_id FROM memories WHERE expires_at IS NOT NULL AND expires_at<=?",
      now,
    );
    this.transaction(() => {
      for (const m of expired) {
        this.invalidate(m.id);
        this.run("DELETE FROM memories WHERE id=?", m.id);
        if (m.media_id) this.run("DELETE FROM media WHERE id=?", m.media_id);
        this.bump(m.family_id);
      }
    });
    this.run("DELETE FROM sessions WHERE expires_at<?", now);
    for (const family of this.all<Family>(
      "SELECT * FROM families WHERE cloud_consent=1",
    )) {
      const owner = this.one<Member>(
        `SELECT ${memberColumns} FROM members WHERE family_id=? AND role='primary' AND active=1`,
        family.id,
      );
      if (!owner) continue;
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: family.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value;
      const dayFormat = new Intl.DateTimeFormat("en-CA", {
        timeZone: family.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const latest = this.artifacts(owner).find((a) => a.kind === "briefing");
      const alreadyPreparedToday =
        latest && dayFormat.format(latest.created_at) === dayFormat.format(now);
      if (Number(get("hour")) >= family.briefing_hour && !alreadyPreparedToday)
        this.queue(
          owner,
          "briefing",
          null,
          `daily:${family.id}:${get("year")}-${get("month")}-${get("day")}:${family.revision}`,
        );
      for (const call of this.calls(owner).filter(
        (c) => c.scheduled_at >= now && c.scheduled_at <= now + 30 * 60000,
      ))
        if (!this.artifacts(owner).some((a) => a.call_id === call.id))
          this.queue(
            owner,
            "call",
            call.id,
            `call:${call.id}:${family.revision}`,
          );
    }
  }
  snapshot(member: Member) {
    const fresh = this.member(member.id);
    const relationships = this.relationshipContext(fresh);
    return {
      now: Date.now(),
      member: fresh,
      family: this.family(member.family_id),
      people: relationships.people.map((p) => ({
        ...p,
        relationship_label: relationshipLabel(p, relationships),
      })),
      members: this.members(fresh).map((m) => ({
        ...m,
        relationship_label: relationshipLabel(m, relationships),
        email: fresh.role === "primary" || m.id === fresh.id ? m.email : "",
      })),
      memories: this.memories(fresh),
      calls: this.calls(fresh),
      artifacts: this.artifacts(fresh),
      jobs: this.all<Job>(
        "SELECT id,family_id,member_id,kind,call_id,status,attempts,error,run_after,lease_until,created_at,updated_at FROM jobs WHERE member_id=? ORDER BY created_at DESC LIMIT 12",
        member.id,
      ),
      messages: this.messages(fresh),
      receipts:
        fresh.role === "primary"
          ? this.all<Receipt>(
              "SELECT id,kind,summary,created_at FROM receipts WHERE family_id=? ORDER BY created_at DESC LIMIT 30",
              member.family_id,
            )
          : [],
      worker: {
        heartbeat:
          Number(
            this.one<{ value: string }>(
              "SELECT value FROM settings WHERE key='heartbeat'",
            )?.value,
          ) || null,
      },
    };
  }
  relationshipContext(member: Member) {
    return {
      member,
      family: this.family(member.family_id),
      people: this.people(member),
      links: this.all<FamilyLink>("SELECT from_id,to_id,kind FROM family_links WHERE family_id=?", member.family_id),
    };
  }
}

const globalStore = globalThis as typeof globalThis & {
  anubandhStore?: FamilyStore;
};
export function getStore() {
  return (globalStore.anubandhStore ??= new FamilyStore(
    process.env.ANUBANDH_DATABASE_PATH ??
      path.join(process.cwd(), ".data", "anubandh", "family.db"),
  ));
}
