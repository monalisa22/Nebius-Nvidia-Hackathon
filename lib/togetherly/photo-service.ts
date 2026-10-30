import { DomainError, id, type FamilyStore } from "../anubandh/store";
import type { Member } from "../anubandh/types";
import { photoCommandSchema, photoResultSchema, photoThemes, type PhotoJob, type PhotoResult } from "./photo-contracts";

function dailyLimit() {
  const value = Number(process.env.TOGETHERLY_PHOTO_DAILY_LIMIT);
  return Number.isInteger(value) && value >= 1 && value <= 50 ? value : 10;
}

export class PhotoService {
  constructor(readonly store: FamilyStore) {}
  enabled(member: Member) {
    return Boolean(this.store.family(member.family_id).cloud_consent && this.store.one<{ enabled: number }>(
      "SELECT enabled FROM photo_permissions WHERE family_id=?", member.family_id)?.enabled);
  }
  private source(member: Member, sourceId: string) {
    const memory = this.store.memory(member, sourceId);
    if (memory.kind !== "photo" || !memory.media_id || memory.status !== "approved")
      throw new DomainError("Choose an approved photograph first.", 409);
    return memory;
  }
  context(job: PhotoJob) {
    const member = this.store.member(job.member_id);
    if (!this.enabled(member)) throw new DomainError("Photo AI permission is off.", 403);
    if (member.role !== "primary" && !member.can_contribute) throw new DomainError("Contributing access is required.", 403);
    const memory = this.source(member, job.source_id);
    if (memory.revision !== job.source_revision || memory.media_id !== job.media_id)
      throw new DomainError("This photograph or its story changed. Request fresh suggestions.", 409);
    // No family names, identity hints or profile information are needed for visual observations.
    return { member, memory, language: this.store.family(member.family_id).language };
  }
  private available(member: Member, jobId: string) {
    const job = this.store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE id=? AND family_id=?", jobId, member.family_id);
    if (!job) throw new DomainError("Photo suggestions are not available.", 404);
    this.source(member, job.source_id);
    if (member.role !== "primary" && job.member_id !== member.id && job.status !== "approved")
      throw new DomainError("These suggestions are awaiting family review.", 403);
    return job;
  }
  snapshot(member: Member) {
    member = this.store.member(member.id);
    const readable = this.store.memories(member, true);
    const memories = new Map(readable.map(m => [m.id, m]));
    const analyses = this.store.all<PhotoJob>("SELECT * FROM photo_analyses WHERE family_id=? ORDER BY created_at DESC", member.family_id)
      .filter(j => memories.get(j.source_id)?.revision === j.source_revision &&
        (member.role === "primary" || j.member_id === member.id || j.status === "approved"))
      .map(j => ({ id: j.id, sourceId: j.source_id, status: j.status, revision: j.revision, error: j.error,
        provider: j.provider, model: j.model, createdAt: j.created_at,
        content: j.reviewed ? photoResultSchema.parse(JSON.parse(j.reviewed)) :
          j.result ? photoResultSchema.parse(JSON.parse(j.result)) : null }));
    const approved = analyses.filter(a => a.status === "approved" && a.content);
    const collections = Object.entries(photoThemes).map(([theme, title]) => {
      const sourceIds = approved.filter(a => a.content!.themes.includes(theme as keyof typeof photoThemes)).map(a => a.sourceId);
      const dated = sourceIds.map(sourceId => ({ sourceId, date: this.store.one<{ occurred_on: string | null }>(
        "SELECT occurred_on FROM memory_context WHERE source_id=?", sourceId)?.occurred_on ?? null }));
      // Dates are family-confirmed event dates, never inferred from upload order.
      dated.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.sourceId.localeCompare(b.sourceId));
      return { theme, title, sourceIds: dated.map(d => d.sourceId) };
    }).filter(c => c.sourceIds.length);
    return { enabled: this.enabled(member), dailyLimit: dailyLimit(), analyses, collections };
  }
  command(member: Member, input: unknown): Record<string, unknown> {
    member = this.store.member(member.id);
    const command = photoCommandSchema.parse(input);
    return this.store.transaction(() => {
      if (command.action === "photo-permission") {
        this.store.primary(member);
        if (command.enabled && !this.store.family(member.family_id).cloud_consent)
          throw new DomainError("Enable family AI before allowing photo processing.", 403);
        this.store.run("INSERT INTO photo_permissions VALUES(?,?) ON CONFLICT(family_id) DO UPDATE SET enabled=excluded.enabled", member.family_id, Number(command.enabled));
        if (!command.enabled) this.store.run("DELETE FROM photo_analyses WHERE family_id=?", member.family_id);
        this.store.bump(member.family_id);
        this.store.audit(member, "photo_permission", command.enabled ? "Selected photo processing allowed." : "Photo processing stopped and derived photo details removed.");
        return {};
      }
      if (command.action === "photo-analyze") {
        const memory = this.source(member, command.sourceId);
        if (!this.enabled(member)) throw new DomainError("Allow photo processing in My choices first.", 403);
        if (member.role !== "primary" && (!member.can_contribute || memory.author_id !== member.id))
          throw new DomainError("Choose a photograph you contributed.", 403);
        const existing = this.store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE source_id=? AND source_revision=?", memory.id, memory.revision);
        if (existing && ["queued", "running", "ready", "approved", "dismissed"].includes(existing.status)) return { id: existing.id };
        this.store.throttle(`photo-ai:${member.family_id}`, dailyLimit(), 86400000);
        this.store.throttle(`ai:${member.family_id}`, 30, 3600000);
        const jobId = existing?.id ?? id();
        if (existing) this.store.run("UPDATE photo_analyses SET member_id=?,status='queued',error=NULL,revision=revision+1,lease_token=NULL,lease_until=NULL WHERE id=?", member.id, jobId);
        else this.store.run(`INSERT INTO photo_analyses(id,family_id,member_id,source_id,source_revision,media_id,created_at) VALUES(?,?,?,?,?,?,?)`,
          jobId, member.family_id, member.id, memory.id, memory.revision, memory.media_id, Date.now());
        return { id: jobId };
      }
      const job = this.available(member, command.id);
      if (command.action === "photo-cancel") {
        if (member.role !== "primary" && member.id !== job.member_id) throw new DomainError("Only the requester can cancel this analysis.", 403);
        this.store.run("UPDATE photo_analyses SET status='cancelled',lease_token=NULL,lease_until=NULL,revision=revision+1 WHERE id=? AND status IN ('queued','running')", job.id);
        return {};
      }
      this.store.primary(member);
      if (!this.enabled(member)) throw new DomainError("Photo AI permission is off.", 403);
      if (job.revision !== command.revision || !["ready", "approved"].includes(job.status))
        throw new DomainError("These suggestions changed. Reopen the photograph.", 409);
      if (command.action === "photo-review") {
        this.store.run("UPDATE photo_analyses SET reviewed=?,status='approved',revision=revision+1 WHERE id=?", JSON.stringify(command.content), job.id);
      } else this.store.run("UPDATE photo_analyses SET reviewed=NULL,result=NULL,status='dismissed',revision=revision+1 WHERE id=?", job.id);
      this.store.invalidate(job.source_id);
      this.store.bump(member.family_id);
      this.store.audit(member, "photo_reviewed", "Photo details reviewed separately from the original family story.");
      return {};
    });
  }
  claim() {
    return this.store.transaction(() => {
      this.store.run("UPDATE photo_analyses SET status='failed',error='Photo preparation timed out. Retry when ready.',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<=?", Date.now());
      const job = this.store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE status='queued' ORDER BY created_at LIMIT 1");
      if (!job) return null;
      const token = id();
      this.store.run("UPDATE photo_analyses SET status='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=?", token, Date.now() + 150000, job.id);
      return this.store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE id=?", job.id)!;
    });
  }
  commit(job: PhotoJob, result: PhotoResult, provider: string, model: string | null) {
    return this.store.transaction(() => {
      const current = this.store.one<PhotoJob>("SELECT * FROM photo_analyses WHERE id=?", job.id);
      if (!current || current.status !== "running" || current.lease_token !== job.lease_token || (current.lease_until ?? 0) <= Date.now()) return false;
      this.context(current);
      this.store.run("UPDATE photo_analyses SET status='ready',result=?,provider=?,model=?,error=NULL,lease_token=NULL,lease_until=NULL,revision=revision+1 WHERE id=?",
        JSON.stringify(photoResultSchema.parse(result)), provider, model, job.id);
      return true;
    });
  }
  fail(job: PhotoJob, message: string) {
    this.store.run("UPDATE photo_analyses SET status='failed',error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND status='running' AND lease_token=?", message, job.id, job.lease_token);
  }
}
