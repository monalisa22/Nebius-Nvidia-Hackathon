import { DomainError, hash, id, isDomainError, type FamilyStore } from "../anubandh/store";
import type { Member } from "../anubandh/types";
import { relationshipLabel } from "../anubandh/relationships";
import {
  ritualCommandSchema, ritualResultSchema, ritualSkills, callSkillSchema, defaultCallSkill,
  type Ritual, type RitualResult, type RitualRun, type RitualReceipt,
} from "./ritual-contracts";
import { hermesStatus } from "./hermes-status";
import { approvedPhotoEvidence, resolveMemoryQuote } from "./photo-evidence";

const DAY = 86400000;
const LEASE = 300000;
const interval = { manual: 0, daily: DAY, weekly: 7 * DAY, "before-call": 0 };

export class RitualService {
  constructor(readonly store: FamilyStore) {}

  private owned(member: Member, ritualId: string) {
    member = this.store.member(member.id);
    const ritual = this.store.one<Ritual>("SELECT * FROM connection_rituals WHERE id=? AND member_id=?", ritualId, member.id);
    if (!ritual) throw new DomainError("Connection ritual not found.", 404);
    return ritual;
  }

  context(ritual: Ritual) {
    const member = this.store.member(ritual.member_id);
    const family = this.store.family(member.family_id);
    if (ritual.engine === "hermes" && !hermesStatus().available) throw new DomainError("The Hermes pilot is not available on this server.", 503);
    if (!family.cloud_consent) throw new DomainError("Family AI permission is off.", 403);
    if (member.role !== "primary" && !member.can_view) throw new DomainError("Family viewing permission is required.", 403);
    if (!ritual.enabled || (ritual.expires_at && ritual.expires_at <= Date.now()))
      throw new DomainError("This ritual is paused or its permission has expired.", 409);
    const recipient = this.store.member(ritual.recipient_id);
    if (recipient.family_id !== member.family_id || recipient.id === member.id || !recipient.person_id)
      throw new DomainError("Choose an available relative with a family profile.", 409);
    const relationships = this.store.relationshipContext(member);
    const people = this.store.people(member);
    const sourceIds = JSON.parse(ritual.source_ids) as string[];
    const sources = sourceIds.map(sourceId => {
      const memory = this.store.memory(member, sourceId);
      const photoEvidence = approvedPhotoEvidence(this.store.db, memory);
      if (memory.status !== "approved" || (!memory.caption.trim() && !photoEvidence))
        throw new DomainError("Every chosen memory needs an approved story or reviewed photo details.", 409);
      const tags = JSON.parse(memory.person_ids) as string[];
      if (memory.author_id !== recipient.id && !tags.includes(recipient.person_id!))
        throw new DomainError("Choose memories shared by or tagged with this relative.", 409);
      return {
        id: memory.id, revision: memory.revision, title: memory.title, caption: memory.caption, contributedAt: memory.created_at,
        photoEvidence,
        contributedBy: { name: this.store.members(member).find(m => m.id === memory.author_id)?.name ?? "Family member", isViewer: memory.author_id === member.id },
        people: people.filter(p => tags.includes(p.id)).map(p => ({ name: p.name, relationshipToViewer: relationshipLabel(p, relationships) })),
      };
    });
    const packet = {
      skill: ritual.skill, skillVersion: ritualSkills[ritual.skill].version,
      preferences: callSkillSchema.parse(JSON.parse(ritual.skill_config)),
      language: family.language, viewer: { name: member.name },
      relative: { name: recipient.name, relationshipToViewer: relationshipLabel(recipient, relationships) },
      allowedProposal: ritual.allow_action ? ritualSkills[ritual.skill].proposal : "none",
      sources,
    };
    return { packet, fingerprint: hash(JSON.stringify({ packet, revision: ritual.revision, familyRevision: family.revision })) };
  }

  private expire(runId: string) {
    this.store.run("UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL WHERE id=?", runId);
  }

  private valid(run: RitualRun) {
    if (run.expires_at <= Date.now()) return false;
    const ritual = this.store.one<Ritual>("SELECT * FROM connection_rituals WHERE id=?", run.ritual_id);
    if (!ritual || ritual.revision !== run.revision) return false;
    try { return this.context(ritual).fingerprint === run.fingerprint; }
    catch (error) { if (isDomainError(error)) return false; throw error; }
  }

  private purge(memberId?: string) {
    for (const run of this.store.all<RitualRun>(`SELECT j.* FROM ritual_runs j JOIN connection_rituals r ON r.id=j.ritual_id
      WHERE j.status IN ('queued','running','ready','applied') ${memberId ? "AND r.member_id=?" : ""}`, ...(memberId ? [memberId] : [])))
      if (!this.valid(run)) this.expire(run.id);
    this.store.run("DELETE FROM ritual_runs WHERE expires_at<=?", Date.now());
  }

  snapshot(member: Member) {
    member = this.store.member(member.id);
    this.purge(member.id);
    const rituals = this.store.all<Ritual>("SELECT * FROM connection_rituals WHERE member_id=? ORDER BY created_at DESC", member.id);
    return {
      skills: ritualSkills,
      rituals: rituals.map(r => {
        let unavailable: string | null = null;
        try { this.context(r); } catch (e) { unavailable = isDomainError(e) ? e.message : "This ritual is unavailable."; }
        return { ...r, preferences: callSkillSchema.parse(JSON.parse(r.skill_config)), sourceIds: JSON.parse(r.source_ids) as string[], unavailable };
      }),
      runs: this.store.all<RitualRun>(`SELECT j.* FROM ritual_runs j JOIN connection_rituals r ON r.id=j.ritual_id
        WHERE r.member_id=? ORDER BY j.created_at DESC,j.rowid DESC LIMIT 40`, member.id).map(j => ({
        id: j.id, ritualId: j.ritual_id, status: j.status, createdAt: j.created_at, expiresAt: j.expires_at,
        error: j.error, provider: j.provider, model: j.model, outcomeId: j.outcome_id,
        result: j.result ? ritualResultSchema.parse(JSON.parse(j.result)) : null,
        task: j.task, instruction: j.instruction,
        skillProposal: j.skill_proposal ? callSkillSchema.parse(JSON.parse(j.skill_proposal)) : null,
        receipt: JSON.parse(j.receipt) as RitualReceipt[],
        sources: this.store.all<{ source_id: string; revision: number }>("SELECT source_id,revision FROM ritual_sources WHERE run_id=?", j.id)
          .filter(s => { try { this.store.memory(member, s.source_id); return true; } catch { return false; } }),
      })),
      runtime: { execution: "bounded-application-worker", sandbox: "not-configured", automaticSending: false, hermes: hermesStatus() } as const,
    };
  }

  queue(member: Member, ritualId: string, instruction?: string) {
    return this.store.transaction(() => {
    const ritual = this.owned(member, ritualId);
    const context = this.context(ritual);
    const current = this.store.one<RitualRun>("SELECT * FROM ritual_runs WHERE ritual_id=? AND status IN ('queued','running')", ritual.id);
    if (current) {
      if (instruction) throw new DomainError("Wait for the current preparation or cancel it first.", 409);
      return current.id;
    }
    this.store.throttle(`ritual-ai:${member.id}`, 12, 3600000);
    const runId = id();
    this.store.run(`INSERT INTO ritual_runs(id,ritual_id,revision,fingerprint,run_after,created_at,expires_at,task,instruction)
      VALUES(?,?,?,?,?,?,?,?,?)`, runId, ritual.id, ritual.revision, context.fingerprint, Date.now(), Date.now(),
    Math.min(Date.now() + 7 * DAY, ritual.expires_at ?? Infinity), instruction ? "learn" : "prepare", instruction ?? null);
    for (const source of context.packet.sources)
      this.store.run("INSERT INTO ritual_sources VALUES(?,?,?)", runId, source.id, source.revision);
    return runId;
    });
  }

  command(member: Member, input: unknown): Record<string, unknown> {
    member = this.store.member(member.id);
    const command = ritualCommandSchema.parse(input);
    return this.store.transaction(() => {
      switch (command.action) {
        case "ritual-save": {
          const previous = command.id ? this.owned(member, command.id) : null;
          if (previous && previous.revision !== command.revision) throw new DomainError("This ritual changed. Reopen it before saving.", 409);
          if (command.expiresAt && command.expiresAt <= Date.now()) throw new DomainError("Choose a future permission expiry.");
          if (!previous && (this.store.one<{ count: number }>("SELECT COUNT(*) count FROM connection_rituals WHERE member_id=?", member.id)?.count ?? 0) >= 8)
            throw new DomainError("Keep up to eight rituals. Remove one before adding another.");
          const ritual: Ritual = {
            id: previous?.id ?? id(), member_id: member.id, recipient_id: command.recipientId,
            skill: command.skill, source_ids: JSON.stringify(command.sourceIds), cadence: command.cadence,
            allow_action: Number(command.allowAction), enabled: 1, revision: (previous?.revision ?? 0) + 1,
            expires_at: command.expiresAt, next_run_at: interval[command.cadence] ? Date.now() + interval[command.cadence] : null,
            created_at: previous?.created_at ?? Date.now(),
            engine: command.engine, skill_config: previous?.skill_config ?? JSON.stringify(defaultCallSkill),
          };
          if (ritual.engine === "hermes" && ritual.skill !== "call") throw new DomainError("Hermes is currently available for call preparation only.");
          this.context(ritual);
          if (previous) this.store.run("UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL WHERE ritual_id=?", previous.id);
          this.store.run(`INSERT INTO connection_rituals(id,member_id,recipient_id,skill,source_ids,cadence,allow_action,enabled,revision,expires_at,next_run_at,created_at,engine,skill_config)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            recipient_id=excluded.recipient_id,skill=excluded.skill,source_ids=excluded.source_ids,cadence=excluded.cadence,
            allow_action=excluded.allow_action,enabled=1,revision=excluded.revision,expires_at=excluded.expires_at,next_run_at=excluded.next_run_at,engine=excluded.engine`,
          ritual.id, ritual.member_id, ritual.recipient_id, ritual.skill, ritual.source_ids, ritual.cadence,
          ritual.allow_action, ritual.enabled, ritual.revision, ritual.expires_at, ritual.next_run_at, ritual.created_at, ritual.engine, ritual.skill_config);
          this.store.audit(member, "ritual_saved", "A private connection skill and its chosen source permissions were saved.");
          return { id: ritual.id };
        }
        case "ritual-run": return { id: this.queue(member, command.id) };
        case "ritual-learn": {
          const ritual = this.owned(member, command.id);
          if (ritual.engine !== "hermes") throw new DomainError("Choose Hermes for this ritual before teaching a routine.");
          return { id: this.queue(member, ritual.id, command.instruction) };
        }
        case "ritual-skill-approve": {
          const run = this.store.one<RitualRun>(`SELECT j.* FROM ritual_runs j JOIN connection_rituals r ON r.id=j.ritual_id
            WHERE j.id=? AND r.member_id=?`, command.id, member.id);
          if (!run || run.task !== "learn") throw new DomainError("Routine proposal not found.", 404);
          if (run.status !== "ready" || !run.skill_proposal || !this.valid(run)) throw new DomainError("This proposal is no longer current. Request it again.", 409);
          const preferences = callSkillSchema.parse(JSON.parse(run.skill_proposal));
          this.store.run("UPDATE connection_rituals SET skill_config=?,revision=revision+1 WHERE id=?", JSON.stringify(preferences), run.ritual_id);
          this.store.run("UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL WHERE ritual_id=?", run.ritual_id);
          this.store.audit(member, "ritual_skill_approved", "A reviewed call-preparation routine was updated. Source and action permissions were unchanged.");
          return { id: run.ritual_id };
        }
        case "ritual-toggle": {
          const ritual = this.owned(member, command.id);
          if (ritual.revision !== command.revision) throw new DomainError("This ritual changed. Refresh first.", 409);
          if (command.enabled) this.context({ ...ritual, enabled: 1 });
          this.store.run("UPDATE connection_rituals SET enabled=?,revision=revision+1,next_run_at=? WHERE id=?",
            Number(command.enabled), command.enabled && interval[ritual.cadence] ? Date.now() + interval[ritual.cadence] : null, ritual.id);
          this.store.run("UPDATE ritual_runs SET status='expired',result=NULL,lease_token=NULL,lease_until=NULL WHERE ritual_id=?", ritual.id);
          return {};
        }
        case "ritual-delete": {
          this.owned(member, command.id);
          this.store.run("DELETE FROM connection_rituals WHERE id=?", command.id);
          return {};
        }
        case "ritual-dismiss":
        case "ritual-approve": {
          const run = this.store.one<RitualRun>(`SELECT j.* FROM ritual_runs j JOIN connection_rituals r ON r.id=j.ritual_id
            WHERE j.id=? AND r.member_id=?`, command.id, member.id);
          if (!run) throw new DomainError("Prepared moment not found.", 404);
          if (command.action === "ritual-dismiss") {
            this.store.run("UPDATE ritual_runs SET status='dismissed',result=NULL,lease_token=NULL,lease_until=NULL WHERE id=?", run.id);
            return {};
          }
          if (run.status === "applied") return { id: run.outcome_id ?? undefined };
          if (run.status !== "ready" || !run.result || !this.valid(run))
            throw new DomainError("This preparation is no longer current. Prepare it again before approving.", 409);
          const ritual = this.owned(member, run.ritual_id);
          const result = validateRitual(JSON.parse(run.result), this.context(ritual).packet);
          if (!ritual.allow_action || result.proposal.tool === "none") throw new DomainError("This ritual has no action permission.", 403);
          let outcomeId: string;
          let tool: string;
          if (result.proposal.tool === "reply.offer") {
            const recipient = this.store.member(ritual.recipient_id);
            // Every consulted source must be shareable, not just the sources cited by the model.
            for (const sourceId of JSON.parse(ritual.source_ids) as string[]) {
              const memory = this.store.memory(member, sourceId);
              if (!this.store.canRead(recipient, memory))
                throw new DomainError("A chosen memory is private from this relative. Change the ritual's sources before sending.", 403);
            }
            outcomeId = this.store.createMessage(member, recipient.id, command.text, null);
            this.store.sendMessage(member, outcomeId, 1);
            tool = "reply.send";
          } else {
            outcomeId = id();
            this.store.run("INSERT INTO memory_walks VALUES(?,?,?,0,'paused',?)", outcomeId, member.id, command.text.slice(0, 200), Date.now());
            result.proposal.sourceIds.forEach((sourceId, index) => this.store.run("INSERT INTO memory_walk_items VALUES(?,?,?)", outcomeId, sourceId, index));
            tool = "walk.create";
          }
          const receipt: RitualReceipt[] = [...JSON.parse(run.receipt), { tool, status: "completed", at: Date.now() }];
          this.store.run("UPDATE ritual_runs SET status='applied',outcome_id=?,receipt=? WHERE id=?", outcomeId, JSON.stringify(receipt), run.id);
          this.store.audit(member, "ritual_approved", "An explicitly reviewed connection action was completed.");
          return { id: outcomeId };
        }
      }
    });
  }

  tick() {
    this.purge();
    for (const ritual of this.store.all<Ritual>("SELECT * FROM connection_rituals WHERE enabled=1 AND next_run_at<=? LIMIT 50", Date.now())) {
      this.store.transaction(() => {
        const current = this.store.one<Ritual>("SELECT * FROM connection_rituals WHERE id=?", ritual.id);
        if (!current?.enabled || !current.next_run_at || current.next_run_at > Date.now()) return;
        try { this.queue(this.store.member(current.member_id), current.id); }
        catch (e) { if (!isDomainError(e)) throw e; }
        this.store.run("UPDATE connection_rituals SET next_run_at=? WHERE id=?", interval[current.cadence] ? Date.now() + interval[current.cadence] : null, current.id);
      });
    }
    for (const ritual of this.store.all<Ritual>("SELECT * FROM connection_rituals WHERE enabled=1 AND cadence='before-call' LIMIT 100")) {
      this.store.transaction(() => {
        try {
          const member = this.store.member(ritual.member_id);
          const recipient = this.store.member(ritual.recipient_id);
          const call = this.store.calls(member).find(c => c.person_id === recipient.person_id && c.scheduled_at > Date.now() && c.scheduled_at <= Date.now() + 15 * 60000);
          if (!call || this.store.one("SELECT id FROM ritual_runs WHERE ritual_id=? AND status IN ('running','queued')", ritual.id)) return;
          const key = `${call.id}:${call.scheduled_at}:${ritual.revision}:${this.store.family(member.family_id).revision}`;
          if (this.store.one("SELECT id FROM ritual_runs WHERE ritual_id=? AND trigger_key=?", ritual.id, key)) return;
          const runId = this.queue(member, ritual.id);
          this.store.run("UPDATE ritual_runs SET trigger_key=? WHERE id=?", key, runId);
        } catch (e) { if (!isDomainError(e)) throw e; }
      });
    }
  }

  claim() {
    return this.store.transaction(() => {
      this.store.run("UPDATE ritual_runs SET status='failed',error='Preparation timed out. Try again.',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<=? AND attempts>=3", Date.now());
      const run = this.store.one<RitualRun>(`SELECT * FROM ritual_runs WHERE attempts<3 AND
        ((status='queued' AND run_after<=?) OR (status='running' AND lease_until<=?)) ORDER BY created_at LIMIT 1`, Date.now(), Date.now());
      if (!run) return null;
      if (!this.valid(run)) { this.expire(run.id); return null; }
      const token = id();
      this.store.run("UPDATE ritual_runs SET status='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=?", token, Date.now() + LEASE, run.id);
      return this.store.one<RitualRun>("SELECT * FROM ritual_runs WHERE id=?", run.id)!;
    });
  }

  runContext(run: RitualRun) {
    const current = this.store.one<RitualRun>("SELECT * FROM ritual_runs WHERE id=?", run.id);
    if (!current || current.status !== "running" || current.lease_token !== run.lease_token || (current.lease_until ?? 0) <= Date.now())
      throw new DomainError("This preparation was cancelled or its lease ended.", 409);
    const ritual = this.store.one<Ritual>("SELECT * FROM connection_rituals WHERE id=?", run.ritual_id);
    if (!ritual || !this.valid(run)) throw new DomainError("The ritual's permissions or memories changed.", 409);
    return this.context(ritual);
  }

  commit(run: RitualRun, content: unknown, provider: string, model: string | null, tools: RitualReceipt[] = []) {
    return this.store.transaction(() => {
      const fresh = this.store.one<RitualRun>("SELECT * FROM ritual_runs WHERE id=?", run.id);
      if (!fresh || fresh.status !== "running" || fresh.lease_token !== run.lease_token || (fresh.lease_until ?? 0) <= Date.now()) return false;
      if (!this.valid(fresh)) { this.expire(fresh.id); return false; }
      const packet = this.runContext(fresh).packet;
      const result = fresh.task === "prepare" ? validateRitual(content, packet) : null;
      const skill = fresh.task === "learn" ? callSkillSchema.parse(content) : null;
      const receipt: RitualReceipt[] = [
        ...tools,
        ...(provider === "hermes-nebius" ? [] : [{ tool: provider === "fixture" ? "fixture.prepare" : "nemotron.prepare", status: "completed" as const, at: Date.now() }]),
        { tool: skill ? "skill.validate" : "evidence.check", status: "completed", at: Date.now() },
        ...(!result || result.proposal.tool === "none" ? [] : [{ tool: result.proposal.tool, status: "awaiting-approval" as const, at: Date.now() }]),
        ...(skill ? [{ tool: "skill.review", status: "awaiting-approval" as const, at: Date.now() }] : []),
      ];
      this.store.run("UPDATE ritual_runs SET status='ready',result=?,skill_proposal=?,receipt=?,provider=?,model=?,lease_token=NULL,lease_until=NULL,error=NULL WHERE id=?",
        result ? JSON.stringify(result) : null, skill ? JSON.stringify(skill) : null, JSON.stringify(receipt), provider, model, fresh.id);
      return true;
    });
  }

  fail(run: RitualRun, retryable: boolean, message?: string) {
    this.store.run(`UPDATE ritual_runs SET status=?,run_after=?,error=?,lease_token=NULL,lease_until=NULL
      WHERE id=? AND status='running' AND lease_token=? AND lease_until>?`,
    retryable && run.attempts < 3 ? "queued" : "failed", Date.now() + 30000 * run.attempts,
    message ?? (retryable ? "AI preparation is temporarily unavailable. Retrying is limited to three attempts." : "Preparation could not be validated. Review your chosen memories and try again."),
    run.id, run.lease_token, Date.now());
  }
}

export type RitualPacket = ReturnType<RitualService["context"]>["packet"];
export function validateRitual(content: unknown, packet: RitualPacket): RitualResult {
  const result = ritualResultSchema.parse(content);
  const seen = new Set<string>();
  const questions = new Set<string>();
  if (packet.skill === "call" && result.moments.length > packet.preferences.maxMoments) throw new DomainError("The preparation exceeded the approved length.");
  for (const moment of result.moments) {
    const source = packet.sources.find(s => s.id === moment.sourceId);
    const quote = source ? resolveMemoryQuote(source, moment.quote, moment.evidenceId) : null;
    if (!source || !quote || quote.length > 1200 || seen.has(moment.sourceId))
      throw new DomainError("The preparation did not match its chosen sources.");
    moment.quote = quote;
    if (packet.language === "en" && moment.caption.split(/\s+/).length > 32)
      throw new DomainError("A prepared caption was too long.");
    if (packet.language === "en" && /^(?:i|my|we|our)\b/i.test(moment.caption.trim()))
      throw new DomainError("Captions must name the contributor, or say You for the viewer; do not retell a source in first person.");
    if (packet.language === "en" && moment.question && !moment.question.toLocaleLowerCase().includes(packet.relative.name.toLocaleLowerCase()))
      throw new DomainError("Every question must address the selected relative by their supplied name, even when the memory is about somebody else.");
    if (moment.question && (moment.question.length < 8 || questions.has(moment.question.toLocaleLowerCase()))) throw new DomainError("The conversation ideas were repetitive or too short.");
    seen.add(moment.sourceId);
    if (moment.question) questions.add(moment.question.toLocaleLowerCase());
  }
  if (!questions.size || (packet.skill === "call" && questions.size > packet.preferences.questionCount)) throw new DomainError("The preparation did not follow the approved question count.");
  const action = result.proposal;
  if (action.tool !== "none" && (action.tool !== packet.allowedProposal || !action.text))
    throw new DomainError("The model proposed a tool outside this ritual's permission.", 403);
  if (action.tool !== "none" && (!action.sourceIds.length || action.sourceIds.some(s => !seen.has(s)) || new Set(action.sourceIds).size !== action.sourceIds.length))
    throw new DomainError("The proposed action must use the cited memories.");
  if (action.tool === "none" && (action.text || action.sourceIds.length)) throw new DomainError("An unapproved action cannot include a payload.");
  return result;
}
