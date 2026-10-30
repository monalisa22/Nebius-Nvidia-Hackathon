import { DomainError, hash, id, type FamilyStore } from "../anubandh/store";
import type { Member, Memory, Message } from "../anubandh/types";
import { relationshipLabel } from "../anubandh/relationships";
import { preparedMemory } from "../anubandh/briefs";
import { RitualService } from "./ritual-service";
import { PhotoService } from "./photo-service";
import {
  activityPrompts, commandSchema, extractionSchema,
  type Activity, type AnniversaryNotice, type Capsule, type ExtractionJob, type Fact,
  type FactProposal, type Preferences,
} from "./contracts";

const DAY = 86400000;
function localDay(time: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  return ["year", "month", "day"].map(k => parts.find(p => p.type === k)!.value).join("-");
}
function active(member: Member) {
  return Boolean(member.active && (!member.expires_at || member.expires_at > Date.now()));
}
type MemoryContext = { source_id: string; occurred_on: string | null; place: string; legacy: number };
type Link = { id: string; family_id: string; from_id: string; to_id: string; kind: string };
type Walk = { id: string; member_id: string; title: string; position: number; status: string; created_at: number };
type Session = { id: string; member_id: string; person_id: string; started_at: number; ended_at: number | null };

function anniversaryText(memory: Memory, yearsAgo: number, eventOn: string) {
  const elapsed = yearsAgo === 1 ? "one year" : `${yearsAgo} years`;
  const title = /diwali/i.test(memory.title) ? `Diwali ${eventOn.slice(0, 4)}` : memory.title;
  if (/diwali|festival|celebrat/i.test(`${memory.title} ${memory.caption}`))
    return `It has been ${elapsed} since ${title}. Take a little time to revisit those moments and plan this year's celebration together.`;
  return `It has been ${elapsed} since ${title}. Would you like to revisit this memory and reconnect with the people who shared it?`;
}

export class CompanionService {
  constructor(readonly store: FamilyStore) {}

  private current(member: Member) { return this.store.member(member.id); }
  private source(member: Member, sourceId: string) {
    const memory = this.store.memory(member, sourceId);
    if (memory.status !== "approved") throw new DomainError("Approve this memory first.", 409);
    return memory;
  }
  private peer(member: Member, peerId: string) {
    const peer = this.store.member(peerId);
    if (peer.family_id !== member.family_id || peer.id === member.id)
      throw new DomainError("Choose an available person in your family.", 404);
    return peer;
  }
  private person(member: Member, personId: string) {
    const person = this.store.people(member).find(p => p.id === personId);
    if (!person) throw new DomainError("Person not found.", 404);
    return person;
  }
  preferences(member: Member): Preferences {
    member = this.current(member);
    return this.store.one<Preferences>("SELECT * FROM companion_preferences WHERE member_id=?", member.id) ?? {
      member_id: member.id, reminders: 0, quiet_days: 21, checkin_enabled: 0,
      trusted_id: null, checkin_days: 3, checked_in_at: member.created_at, auto_insights: 0, memory_reminders: 1,
    };
  }
  private savePreferences(value: Preferences) {
    this.store.run(`INSERT INTO companion_preferences VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(member_id) DO UPDATE SET reminders=excluded.reminders,quiet_days=excluded.quiet_days,
      checkin_enabled=excluded.checkin_enabled,trusted_id=excluded.trusted_id,
      checkin_days=excluded.checkin_days,checked_in_at=excluded.checked_in_at,auto_insights=excluded.auto_insights,
      memory_reminders=excluded.memory_reminders`,
    value.member_id, value.reminders, value.quiet_days, value.checkin_enabled,
    value.trusted_id, value.checkin_days, value.checked_in_at, value.auto_insights, value.memory_reminders);
  }
  facts(member: Member) {
    member = this.current(member);
    const sources = new Map(this.store.memories(member, true).map(m => [m.id, m]));
    return this.store.all<Fact>(`SELECT f.* FROM person_facts f JOIN memories m ON m.id=f.source_id
      WHERE m.family_id=? ORDER BY f.created_at DESC`, member.family_id).filter(f => {
      const source = sources.get(f.source_id);
      return source?.revision === f.source_revision && source.caption.includes(f.quote) &&
        (f.status === "approved" || member.role === "primary" || f.proposed_by === member.id);
    });
  }
  private propose(member: Member, memory: Memory, fact: FactProposal) {
    if (!JSON.parse(memory.person_ids).includes(fact.personId) || !memory.caption.includes(fact.quote))
      throw new DomainError("Use an exact excerpt and a person already tagged in this memory.");
    this.person(member, fact.personId);
    const existing = this.store.one<{ id: string }>(`SELECT id FROM person_facts
      WHERE source_id=? AND source_revision=? AND person_id=? AND category=? AND quote=?`,
    memory.id, memory.revision, fact.personId, fact.category, fact.quote);
    if (existing) return existing.id;
    const factId = id();
    this.store.run("INSERT INTO person_facts VALUES(?,?,?,?,?,?,'pending',?,?)",
      factId, memory.id, memory.revision, fact.personId, fact.category, fact.quote, member.id, Date.now());
    return factId;
  }
  connections(member: Member) {
    member = this.current(member);
    const relationships = this.store.relationshipContext(member);
    const preference = this.preferences(member);
    return this.store.members(member).filter(p => p.id !== member.id && active(p)).map(peer => {
      const messages = this.store.all<Pick<Message, "sender_id" | "delivered_at" | "status">>(
        `SELECT sender_id,delivered_at,status FROM messages WHERE family_id=? AND status!='draft'
        AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))`,
        member.family_id, member.id, peer.id, peer.id, member.id);
      const sentAt = Math.max(0, ...messages.filter(m => m.sender_id === member.id).map(m => m.delivered_at ?? 0));
      const receivedAt = Math.max(0, ...messages.filter(m => m.sender_id === peer.id).map(m => m.delivered_at ?? 0));
      const eventAt = this.store.one<{ time: number | null }>(`SELECT MAX(happened_at) time FROM connection_events
        WHERE family_id=? AND ((actor_id=? AND peer_id=?) OR (actor_id=? AND peer_id=?))`,
      member.family_id, member.id, peer.id, peer.id, member.id)?.time ?? 0;
      const lastConnectedAt = Math.max(sentAt, receivedAt, eventAt) || null;
      const days = lastConnectedAt ? Math.floor((Date.now() - lastConnectedAt) / DAY) : null;
      const awaitingReply = receivedAt > sentAt;
      const reminder = preference.reminders && (awaitingReply || (days !== null && days >= preference.quiet_days))
        ? awaitingReply ? `${peer.name} shared a message. Would you like to reply?`
          : `Your last recorded connection with ${peer.name} was ${days} days ago. Would you like to say hello?`
        : null;
      return { memberId: peer.id, personId: peer.person_id, name: peer.name, relationship: relationshipLabel(peer, relationships),
        lastConnectedAt, daysSinceConnection: days, awaitingReply, reminder,
        basis: "Togetherly messages and manually recorded calls or visits" };
    });
  }
  dailyMoment(member: Member) {
    member = this.current(member);
    const memories = this.store.memories(member, true);
    const date = localDay(Date.now(), this.store.family(member.family_id).timezone);
    const dated = this.store.all<MemoryContext>(`SELECT c.* FROM memory_context c JOIN memories m ON m.id=c.source_id WHERE m.family_id=?`, member.family_id);
    const anniversaries = memories.filter(m => dated.some(d => d.source_id === m.id && d.occurred_on &&
      d.occurred_on.slice(5) === date.slice(5) && d.occurred_on.slice(0, 4) < date.slice(0, 4)));
    const candidates = (anniversaries.length ? anniversaries : memories).sort((a, b) => a.id.localeCompare(b.id));
    if (!candidates.length) return null;
    const selected = candidates[parseInt(hash(`${date}:${member.id}`).slice(0, 8), 16) % candidates.length];
    const occurredOn = dated.find(d => d.source_id === selected.id)?.occurred_on ?? null;
    return { day: date, memory: selected, occurredOn,
      kind: anniversaries.length ? "anniversary" : "revisit",
      yearsAgo: anniversaries.length ? Number(date.slice(0, 4)) - Number(occurredOn!.slice(0, 4)) : null };
  }
  callContext(member: Member, personId: string) {
    member = this.current(member);
    const person = this.person(member, personId);
    const memories = this.store.memories(member, true).filter(m => JSON.parse(m.person_ids).includes(personId)).slice(0, 8);
    const calls = this.store.calls(member);
    const prepared = this.store.artifacts(member).filter(a => a.kind === "call" && calls.some(c => c.id === a.call_id && c.person_id === personId));
    return { person: { ...person, relationship_label: relationshipLabel(person, this.store.relationshipContext(member)) }, memories,
      facts: this.facts(member).filter(f => f.person_id === personId && f.status === "approved"),
      prompts: memories.flatMap(m => (preparedMemory(prepared, m.id)?.starters ?? []).map(text => ({ sourceId: m.id, text }))),
      mode: "approved-context", listening: false };
  }
  private walks(member: Member) {
    const readable = new Set(this.store.memories(member, true).map(m => m.id));
    return this.store.all<Walk>("SELECT * FROM memory_walks WHERE member_id=? ORDER BY created_at DESC", member.id).map(w => {
      const items = this.store.all<{ source_id: string; ordinal: number }>("SELECT * FROM memory_walk_items WHERE walk_id=? ORDER BY ordinal", w.id)
        .filter(item => readable.has(item.source_id));
      return { ...w, items, currentSourceId: items.find(i => i.ordinal === w.position)?.source_id ?? null };
    });
  }
  private anniversaryNotices(member: Member, memories: Memory[]) {
    const readable = new Map(memories.map(memory => [memory.id, memory]));
    const contexts = new Map(this.store.all<MemoryContext>(`SELECT c.* FROM memory_context c
      JOIN memories m ON m.id=c.source_id WHERE m.family_id=?`, member.family_id).map(context => [context.source_id, context]));
    return this.store.all<AnniversaryNotice>(`SELECT * FROM memory_anniversary_notices
      WHERE member_id=? AND dismissed_at IS NULL ORDER BY created_at DESC`, member.id).flatMap(notice => {
      const memory = readable.get(notice.source_id);
      const context = contexts.get(notice.source_id);
      if (!memory || context?.occurred_on !== notice.event_on) return [];
      return [{ id: notice.id, sourceId: memory.id, authorId: memory.author_id, title: memory.title,
        eventOn: notice.event_on, yearsAgo: notice.years_ago, createdAt: notice.created_at,
        readAt: notice.read_at, text: anniversaryText(memory, notice.years_ago, notice.event_on) }];
    });
  }
  snapshot(member: Member) {
    member = this.current(member);
    const memories = this.store.memories(member, true);
    const readable = new Set(memories.map(m => m.id));
    const activities = this.store.all<Activity>(`SELECT * FROM family_activities WHERE family_id=?
      AND (creator_id=? OR assignee_id=?) ORDER BY created_at DESC`, member.family_id, member.id, member.id)
      .map(a => ({ ...a, evidence_id: a.evidence_id && readable.has(a.evidence_id) ? a.evidence_id : null,
        evidenceAvailable: Boolean(a.evidence_id && readable.has(a.evidence_id)), ...activityPrompts[a.prompt_key] }));
    const notices = this.store.all<{ id: string; recipient_id: string; subject_id: string; baseline: number; created_at: number; read_at: number | null }>(
      "SELECT * FROM companion_notices WHERE recipient_id=? ORDER BY created_at DESC", member.id)
      .flatMap(n => {
        const subject = this.store.members(member).find(m => m.id === n.subject_id && active(m));
        const preference = subject && this.preferences(subject);
        if (!subject || !preference?.checkin_enabled || preference.trusted_id !== member.id || preference.checked_in_at !== n.baseline) return [];
        return [{ id: n.id, subjectId: subject.id, name: subject.name, createdAt: n.created_at, readAt: n.read_at,
          text: `${subject.name} has not recorded their agreed check-in. Would you like to contact them?` }];
      });
    return { now: Date.now(), photos: new PhotoService(this.store).snapshot(member), rituals: new RitualService(this.store).snapshot(member), preferences: this.preferences(member), dailyMoment: this.dailyMoment(member),
      connections: this.connections(member), facts: this.facts(member),
      memoryContext: this.store.all<MemoryContext>("SELECT c.* FROM memory_context c JOIN memories m ON m.id=c.source_id WHERE m.family_id=?", member.family_id).filter(c => readable.has(c.source_id)),
      links: this.store.all<Link>("SELECT * FROM family_links WHERE family_id=?", member.family_id),
      activities, milestones: { memoriesMadeTogether: new Set(activities.filter(a => a.assignee_id === member.id && a.status === "completed" && a.evidenceAvailable).map(a => a.evidence_id)).size },
      capsules: this.store.all<Capsule & { text: string; media_id: string | null; recipient_id: string }>(`SELECT c.*,m.text,m.media_id,m.recipient_id FROM memory_capsules c
        JOIN messages m ON m.id=c.message_id WHERE m.sender_id=? ORDER BY c.deliver_at`, member.id),
      walks: this.walks(member), notices, anniversaryNotices: this.anniversaryNotices(member, memories),
      sessions: this.store.all<Session>("SELECT * FROM companion_sessions WHERE member_id=? ORDER BY started_at DESC LIMIT 20", member.id),
      jobs: this.store.all<Omit<ExtractionJob, "lease_token">>(`SELECT id,member_id,source_id,source_revision,status,attempts,lease_until,run_after,error,created_at,provider,model
        FROM companion_jobs WHERE member_id=? ORDER BY created_at DESC LIMIT 20`, member.id).filter(j => readable.has(j.source_id)),
      activityPrompts,
      capabilities: { automaticTranscription: false, liveCallListening: false, externalDelivery: false, sourceLinkedExtraction: true },
    };
  }

  command(member: Member, input: unknown): Record<string, unknown> {
    member = this.current(member);
    const command = commandSchema.parse(input);
    this.store.throttle(`companion:${member.id}`, 180, 3600000);
    if (command.action.startsWith("ritual-")) return new RitualService(this.store).command(member, command);
    if (command.action.startsWith("photo-")) return new PhotoService(this.store).command(member, command);
    return this.store.transaction(() => {
      switch (command.action) {
        case "memory-context": {
          this.store.primary(member);
          const memory = this.source(member, command.sourceId);
          if (memory.revision !== command.revision) throw new DomainError("This memory changed. Reopen it first.", 409);
          if (command.occurredOn && command.occurredOn > localDay(Date.now(), this.store.family(member.family_id).timezone))
            throw new DomainError("A remembered event cannot be in the future.");
          this.store.run(`INSERT INTO memory_context VALUES(?,?,?,?) ON CONFLICT(source_id)
            DO UPDATE SET occurred_on=excluded.occurred_on,place=excluded.place,legacy=excluded.legacy`,
          memory.id, command.occurredOn, command.place, Number(command.legacy));
          this.store.run("DELETE FROM memory_anniversary_notices WHERE source_id=?", memory.id);
          this.store.run("UPDATE memories SET revision=revision+1,updated_at=? WHERE id=?", Date.now(), memory.id);
          this.store.invalidate(memory.id);
          this.store.bump(member.family_id);
          this.store.audit(member, "memory_context", "Known event details were updated.");
          break;
        }
        case "fact-propose": {
          if (member.role !== "primary" && !member.can_contribute) throw new DomainError("Contribution access is required.", 403);
          return { id: this.propose(member, this.source(member, command.sourceId), command.fact) };
        }
        case "fact-review":
        case "fact-delete": {
          this.store.primary(member);
          const fact = this.facts(member).find(f => f.id === command.id);
          if (!fact) throw new DomainError("Fact not found.", 404);
          if (command.action === "fact-delete") this.store.run("DELETE FROM person_facts WHERE id=?", fact.id);
          else this.store.run("UPDATE person_facts SET status=? WHERE id=?", command.decision, fact.id);
          this.store.audit(member, "fact_review", "A source-linked detail was reviewed or removed.");
          break;
        }
        case "extract": return { id: this.queueExtraction(member, command.sourceId) };
        case "extraction-cancel": {
          this.store.run("UPDATE companion_jobs SET status='cancelled' WHERE id=? AND member_id=? AND status IN ('queued','running')", command.id, member.id);
          break;
        }
        case "link-add": {
          this.store.primary(member);
          this.person(member, command.fromId); this.person(member, command.toId);
          if (command.fromId === command.toId) throw new DomainError("Choose two different people.");
          const [from, to] = command.kind === "parent" ? [command.fromId, command.toId] : [command.fromId, command.toId].sort();
          const links = this.store.all<Link>("SELECT * FROM family_links WHERE family_id=? AND kind='parent'", member.family_id);
          const descendants = new Set([to]);
          for (let i = 0; i <= links.length; i++) for (const link of links) if (descendants.has(link.from_id)) descendants.add(link.to_id);
          if (command.kind === "parent" && descendants.has(from)) throw new DomainError("This parent link would create a family-tree cycle.");
          const linkId = id();
          this.store.run("INSERT OR IGNORE INTO family_links VALUES(?,?,?,?,?)", linkId, member.family_id, from, to, command.kind);
          this.store.run("DELETE FROM artifacts WHERE family_id=?", member.family_id);
          this.store.bump(member.family_id);
          return { id: this.store.one<{ id: string }>("SELECT id FROM family_links WHERE from_id=? AND to_id=? AND kind=?", from, to, command.kind)!.id };
        }
        case "link-delete": {
          this.store.primary(member);
          this.store.run("DELETE FROM family_links WHERE id=? AND family_id=?", command.id, member.family_id);
          this.store.run("DELETE FROM artifacts WHERE family_id=?", member.family_id);
          this.store.bump(member.family_id);
          break;
        }
        case "connection-log": {
          this.peer(member, command.peerId);
          const eventId = id();
          this.store.run("INSERT INTO connection_events VALUES(?,?,?,?,?,?)", eventId, member.family_id, member.id, command.peerId, command.kind, command.happenedAt);
          return { id: eventId };
        }
        case "connection-delete": {
          this.store.run("DELETE FROM connection_events WHERE id=? AND actor_id=?", command.id, member.id);
          break;
        }
        case "preferences": {
          if (command.autoInsights && !this.store.family(member.family_id).cloud_consent)
            throw new DomainError("Allow AI processing in My choices before enabling automatic suggestions.", 403);
          if (command.autoInsights && member.role !== "primary" && !member.can_view)
            throw new DomainError("Family viewing access is required.", 403);
          if (command.checkinEnabled && !command.trustedId) throw new DomainError("Choose a trusted contact.");
          if (command.trustedId) this.peer(member, command.trustedId);
          const previous = this.preferences(member);
          const changed = previous.checkin_enabled !== Number(command.checkinEnabled) || previous.trusted_id !== command.trustedId || previous.checkin_days !== command.checkinDays;
          this.savePreferences({ member_id: member.id, reminders: Number(command.reminders), quiet_days: command.quietDays,
            checkin_enabled: Number(command.checkinEnabled), trusted_id: command.checkinEnabled ? command.trustedId : null,
            checkin_days: command.checkinDays, checked_in_at: changed ? Date.now() : previous.checked_in_at,
            auto_insights: Number(command.autoInsights), memory_reminders: Number(command.memoryReminders) });
          if (previous.auto_insights && !command.autoInsights)
            this.store.run("UPDATE companion_jobs SET status='cancelled' WHERE member_id=? AND status IN ('queued','running')", member.id);
          if (changed || !command.checkinEnabled) this.store.run("DELETE FROM companion_notices WHERE subject_id=?", member.id);
          if (!command.memoryReminders) this.store.run("DELETE FROM memory_anniversary_notices WHERE member_id=?", member.id);
          this.store.audit(member, "checkin_preferences", "Personal connection and check-in preferences were updated.");
          break;
        }
        case "check-in": {
          this.savePreferences({ ...this.preferences(member), checked_in_at: Date.now() });
          this.store.run("DELETE FROM companion_notices WHERE subject_id=?", member.id);
          break;
        }
        case "notice-read": {
          this.store.run("UPDATE companion_notices SET read_at=? WHERE id=? AND recipient_id=?", Date.now(), command.id, member.id);
          break;
        }
        case "anniversary-read": {
          this.store.run("UPDATE memory_anniversary_notices SET read_at=? WHERE id=? AND member_id=? AND dismissed_at IS NULL", Date.now(), command.id, member.id);
          break;
        }
        case "anniversary-dismiss": {
          this.store.run("UPDATE memory_anniversary_notices SET dismissed_at=? WHERE id=? AND member_id=?", Date.now(), command.id, member.id);
          break;
        }
        case "activity-create": {
          if (member.role !== "primary" && !member.can_contribute) throw new DomainError("Contribution access is required.", 403);
          if (command.assigneeId !== member.id) this.peer(member, command.assigneeId);
          this.person(member, command.personId);
          this.store.throttle(`activity:${member.id}`, 20, DAY);
          const activityId = id();
          this.store.run(`INSERT INTO family_activities(id,family_id,creator_id,assignee_id,person_id,prompt_key,status,created_at)
            VALUES(?,?,?,?,?,?,?,?)`, activityId, member.family_id, member.id, command.assigneeId, command.personId, command.promptKey,
          command.assigneeId === member.id ? "accepted" : "invited", Date.now());
          return { id: activityId };
        }
        case "activity-update": {
          const activity = this.store.one<Activity>("SELECT * FROM family_activities WHERE id=? AND family_id=?", command.id, member.family_id);
          if (!activity || (activity.assignee_id !== member.id && activity.creator_id !== member.id)) throw new DomainError("Activity not found.", 404);
          if (command.operation === "cancel") {
            if (activity.creator_id !== member.id || !["invited", "accepted"].includes(activity.status)) throw new DomainError("This activity cannot be cancelled.", 409);
            this.store.run("UPDATE family_activities SET status='cancelled' WHERE id=?", activity.id);
          } else {
            if (activity.assignee_id !== member.id) throw new DomainError("Only the invited person can respond.", 403);
            if (command.operation === "complete") {
              if (activity.status !== "accepted" || !command.evidenceId) throw new DomainError("Accept the activity and choose an approved memory first.", 409);
              const source = this.source(member, command.evidenceId);
              if (source.author_id !== member.id || !JSON.parse(source.person_ids).includes(activity.person_id)) throw new DomainError("Choose your own memory tagged with this person.");
              this.store.run("UPDATE family_activities SET status='completed',evidence_id=?,completed_at=? WHERE id=?", source.id, Date.now(), activity.id);
            } else {
              if (activity.status !== "invited") throw new DomainError("This invitation was already answered.", 409);
              this.store.run("UPDATE family_activities SET status=? WHERE id=?", command.operation === "accept" ? "accepted" : "declined", activity.id);
            }
          }
          break;
        }
        case "capsule-create": {
          const capsuleId = id();
          const messageId = this.store.createMessage(member, command.recipientId, command.text, command.mediaId);
          this.store.run("INSERT INTO memory_capsules(id,message_id,title,deliver_at) VALUES(?,?,?,?)", capsuleId, messageId, command.title, command.deliverAt);
          return { id: capsuleId, revision: 1 };
        }
        case "capsule-approve":
        case "capsule-cancel":
        case "capsule-reschedule": {
          const capsule = this.store.one<Capsule & { recipient_id: string }>(`SELECT c.*,m.recipient_id FROM memory_capsules c JOIN messages m ON m.id=c.message_id
            WHERE c.id=? AND m.sender_id=?`, command.id, member.id);
          if (!capsule) throw new DomainError("Capsule not found.", 404);
          if (capsule.revision !== command.revision || capsule.status === "delivered") throw new DomainError("The capsule changed. Reopen it first.", 409);
          if (command.action === "capsule-approve") {
            this.peer(member, capsule.recipient_id);
            if (capsule.deliver_at <= Date.now()) throw new DomainError("Choose a new future delivery time.");
            if (capsule.status !== "draft") throw new DomainError("Review the capsule as a draft first.", 409);
            this.store.run("UPDATE memory_capsules SET status='scheduled',approved_at=?,revision=revision+1,error=NULL WHERE id=?", Date.now(), capsule.id);
            this.store.audit(member, "capsule_approved", "A future inbox delivery was explicitly approved.");
          } else if (command.action === "capsule-reschedule") {
            this.store.run("UPDATE memory_capsules SET status='draft',deliver_at=?,approved_at=NULL,error=NULL,revision=revision+1 WHERE id=?", command.deliverAt, capsule.id);
          } else {
            this.store.run("UPDATE memory_capsules SET status='cancelled',approved_at=NULL,revision=revision+1 WHERE id=?", capsule.id);
          }
          break;
        }
        case "walk-create": {
          const sourceIds = [...new Set(command.sourceIds)];
          sourceIds.forEach(sourceId => this.source(member, sourceId));
          const walkId = id();
          this.store.run("INSERT INTO memory_walks(id,member_id,title,created_at) VALUES(?,?,?,?)", walkId, member.id, command.title, Date.now());
          sourceIds.forEach((sourceId, index) => this.store.run("INSERT INTO memory_walk_items VALUES(?,?,?)", walkId, sourceId, index));
          return { id: walkId };
        }
        case "walk-progress": {
          const walk = this.walks(member).find(w => w.id === command.id);
          if (!walk) throw new DomainError("Walk not found.", 404);
          if (!walk.items.some(i => i.ordinal === command.position)) throw new DomainError("This memory is no longer available.", 409);
          this.store.run("UPDATE memory_walks SET position=?,status=? WHERE id=?", command.position, command.status, walk.id);
          break;
        }
        case "walk-delete": {
          this.store.run("DELETE FROM memory_walks WHERE id=? AND member_id=?", command.id, member.id);
          break;
        }
        case "session-start": {
          const context = this.callContext(member, command.personId);
          const existing = this.store.one<Session>("SELECT * FROM companion_sessions WHERE member_id=? AND person_id=? AND ended_at IS NULL", member.id, command.personId);
          if (existing) return { id: existing.id, context };
          this.store.run("UPDATE companion_sessions SET ended_at=? WHERE member_id=? AND ended_at IS NULL", Date.now(), member.id);
          const sessionId = id();
          this.store.run("INSERT INTO companion_sessions VALUES(?,?,?,?,NULL)", sessionId, member.id, command.personId, Date.now());
          return { id: sessionId, context };
        }
        case "session-end": {
          this.store.run("UPDATE companion_sessions SET ended_at=? WHERE id=? AND member_id=? AND ended_at IS NULL", Date.now(), command.id, member.id);
          break;
        }
      }
      return { ok: true };
    });
  }

  private queueExtraction(member: Member, sourceId: string) {
    const source = this.source(member, sourceId);
    if (!this.store.family(member.family_id).cloud_consent) throw new DomainError("Allow AI processing in My choices first.", 403);
    if (member.role !== "primary" && !member.can_view) throw new DomainError("Family viewing access is required.", 403);
    const existing = this.store.one<{ id: string }>("SELECT id FROM companion_jobs WHERE source_id=? AND source_revision=? AND member_id=? AND status IN ('queued','running')", sourceId, source.revision, member.id);
    if (existing) return existing.id;
    this.store.throttle(`ai:${member.family_id}`, 30, 3600000);
    const jobId = id();
    this.store.run("INSERT INTO companion_jobs(id,member_id,source_id,source_revision,run_after,created_at) VALUES(?,?,?,?,?,?)", jobId, member.id, sourceId, source.revision, Date.now(), Date.now());
    return jobId;
  }
  extractionContext(job: ExtractionJob) {
    const member = this.store.member(job.member_id);
    const family = this.store.family(member.family_id);
    if (!family.cloud_consent || (member.role !== "primary" && !member.can_view)) throw new DomainError("AI permission or family access changed.", 403);
    const source = this.source(member, job.source_id);
    if (source.revision !== job.source_revision) throw new DomainError("This source changed. Request fresh suggestions.", 409);
    const author = this.store.members(member).find(m => m.id === source.author_id);
    return { member, family, source,
      contributedBy: { name: author?.name ?? source.author_name ?? "Family member", personId: author?.person_id ?? null },
      people: this.store.people(member).filter(p => JSON.parse(source.person_ids).includes(p.id)),
      fingerprint: hash(JSON.stringify([member, family.revision, source.id, source.revision])) };
  }
  claimExtraction() {
    return this.store.transaction(() => {
      this.store.run("UPDATE companion_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Processing was interrupted.' WHERE status='running' AND lease_until<?", Date.now());
      const job = this.store.one<ExtractionJob>("SELECT * FROM companion_jobs WHERE status='queued' AND run_after<=? ORDER BY created_at LIMIT 1", Date.now());
      if (!job) return null;
      const token = id();
      this.store.run("UPDATE companion_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=?", token, Date.now() + 150000, job.id);
      return { ...job, status: "running", attempts: job.attempts + 1, lease_token: token };
    });
  }
  commitExtraction(job: ExtractionJob, fingerprint: string, result: unknown, provider = "manual", model: string | null = null) {
    return this.store.transaction(() => {
      const current = this.store.one<ExtractionJob>("SELECT * FROM companion_jobs WHERE id=?", job.id);
      if (!current || current.status !== "running" || current.lease_token !== job.lease_token) return;
      const context = this.extractionContext(job);
      if (context.fingerprint !== fingerprint) throw new DomainError("Context changed. Request fresh suggestions.", 409);
      for (const fact of extractionSchema.parse(result).facts) this.propose(context.member, context.source, fact);
      this.store.run("UPDATE companion_jobs SET status='completed',error=NULL,lease_until=NULL,provider=?,model=? WHERE id=?", provider, model, job.id);
      this.store.audit(context.member, "facts_proposed", "Source-linked details were prepared for review.");
    });
  }
  failExtraction(job: ExtractionJob, retryable: boolean, message = "Suggestions could not be completed. Check the source and AI permission before retrying.") {
    this.store.run(`UPDATE companion_jobs SET status=?,error=?,run_after=?,lease_until=NULL WHERE id=? AND status='running' AND lease_token=?`,
      retryable && job.attempts < 3 ? "queued" : "failed", message,
      Date.now() + job.attempts * 10000, job.id, job.lease_token);
  }

  tick() {
    for (const preference of this.store.all<Preferences>("SELECT * FROM companion_preferences WHERE auto_insights=1")) {
      try {
        const member = this.store.member(preference.member_id);
        if (!this.store.family(member.family_id).cloud_consent) continue;
        const source = this.store.memories(member, true).find(m => !this.store.one(
          "SELECT id FROM companion_jobs WHERE source_id=? AND source_revision=? AND member_id=?", m.id, m.revision, member.id,
        ));
        if (source) this.queueExtraction(member, source.id);
      } catch { /* Changed access or the shared AI rate limit stops automatic work. */ }
    }
    // A scheduled capsule references a single private draft, so retries cannot create duplicate messages.
    for (const capsule of this.store.all<Capsule>("SELECT * FROM memory_capsules WHERE status='scheduled' AND deliver_at<=? LIMIT 100", Date.now())) {
      try {
        this.store.transaction(() => {
          const current = this.store.one<Capsule>("SELECT * FROM memory_capsules WHERE id=?", capsule.id);
          if (current?.status !== "scheduled" || current.deliver_at > Date.now()) return;
          const message = this.store.one<Message>("SELECT * FROM messages WHERE id=?", capsule.message_id)!;
          const sender = this.store.member(message.sender_id);
          this.peer(sender, message.recipient_id);
          this.store.sendMessage(sender, message.id, message.revision, true);
          this.store.run("UPDATE memory_capsules SET status='delivered',revision=revision+1,error=NULL WHERE id=?", capsule.id);
        });
      } catch {
        this.store.run("UPDATE memory_capsules SET status='failed',revision=revision+1,error='Delivery paused. Review account access and choose a new date.' WHERE id=? AND status='scheduled'", capsule.id);
      }
    }
    for (const preference of this.store.all<Preferences>("SELECT * FROM companion_preferences WHERE checkin_enabled=1 AND trusted_id IS NOT NULL AND checked_in_at+checkin_days*?<=?", DAY, Date.now())) {
      try {
        const subject = this.store.member(preference.member_id);
        this.peer(subject, preference.trusted_id!);
        this.store.run("INSERT OR IGNORE INTO companion_notices VALUES(?,?,?,?,?,NULL)", id(), preference.trusted_id, subject.id, preference.checked_in_at, Date.now());
      } catch { /* Expired or revoked access cannot receive a check-in notice. */ }
    }
    for (const reminderMember of this.store.all<{ id: string }>(`SELECT m.id FROM members m
      LEFT JOIN companion_preferences p ON p.member_id=m.id
      WHERE m.active=1 AND (m.expires_at IS NULL OR m.expires_at>?) AND COALESCE(p.memory_reminders,1)=1`, Date.now())) {
      try {
        const member = this.store.member(reminderMember.id);
        if (!active(member)) continue;
        const family = this.store.family(member.family_id);
        const today = localDay(Date.now(), family.timezone);
        const year = Number(today.slice(0, 4));
        const todayTime = Date.parse(`${today}T00:00:00Z`);
        const contexts = new Map(this.store.all<MemoryContext>(`SELECT c.* FROM memory_context c
          JOIN memories m ON m.id=c.source_id WHERE m.family_id=?`, member.family_id).map(context => [context.source_id, context]));
        for (const memory of this.store.memories(member, true)) {
          const eventOn = contexts.get(memory.id)?.occurred_on;
          if (!eventOn || Number(eventOn.slice(0, 4)) >= year) continue;
          const anniversary = `${year}-${eventOn.slice(5)}`;
          const anniversaryTime = Date.parse(`${anniversary}T00:00:00Z`);
          if (!Number.isFinite(anniversaryTime) || new Date(anniversaryTime).toISOString().slice(0, 10) !== anniversary) continue;
          const age = todayTime - anniversaryTime;
          if (age < 0 || age > 7 * DAY) continue;
          this.store.run(`INSERT OR IGNORE INTO memory_anniversary_notices
            (id,member_id,source_id,event_on,anniversary_year,years_ago,created_at)
            VALUES(?,?,?,?,?,?,?)`, id(), member.id, memory.id, eventOn, year, year - Number(eventOn.slice(0, 4)), Date.now());
        }
      } catch { /* Changed access or dates stop the reminder without affecting memories. */ }
    }
    this.store.run(`UPDATE companion_jobs SET status='cancelled',error='AI permission or source changed.' WHERE status IN ('queued','running') AND (
      source_id IN (SELECT m.id FROM memories m JOIN families f ON f.id=m.family_id WHERE f.cloud_consent=0 OR m.status!='approved' OR (m.expires_at IS NOT NULL AND m.expires_at<=?))
      OR member_id IN (SELECT id FROM members WHERE active=0 OR (expires_at IS NOT NULL AND expires_at<=?) OR (role!='primary' AND can_view=0)))`, Date.now(), Date.now());
  }
}

export type CompanionSnapshot = ReturnType<CompanionService["snapshot"]>;
