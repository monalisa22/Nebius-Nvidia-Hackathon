"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, LoaderCircle, Pause, Pencil, Play, Plus, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useCompanion, displayDate } from "./companion-context";
import { Empty, LocalReadAloud, Modal } from "./primitives";
import { ritualSkills, type CallSkill, type RitualSettings } from "@/lib/togetherly/ritual-contracts";
import type { CompanionSnapshot } from "@/lib/togetherly/service";

type RitualView = CompanionSnapshot["rituals"]["rituals"][number];
type RunView = CompanionSnapshot["rituals"]["runs"][number];
const cadenceLabels = { manual: "When I ask", daily: "Every 24 hours", weekly: "Every 7 days", "before-call": "15 minutes before scheduled calls" };

export function RitualInvitation() {
  const { state } = useCompanion();
  const ready = state?.rituals.runs.filter(r => r.status === "ready").length ?? 0;
  return <Link className="make-memory-invitation ritual-invitation" href="/rituals">
    <Sparkles size={21} /><span>{ready ? `${ready} personal preparation${ready === 1 ? "" : "s"} ready for you` : "A little closer, before your next call"}</span><ArrowRight size={19} />
  </Link>;
}

function SkillSummary({ value }: { value: CallSkill }) {
  return <ul className="ritual-preferences">
    <li>Up to {value.maxMoments} {value.maxMoments === 1 ? "memory" : "memories"}</li>
    <li>Up to {value.questionCount} {value.questionCount === 1 ? "question" : "questions"}</li>
    <li>{value.focus === "recent" ? "Newer contributions first" : "A mix of chosen memories"}</li>
    <li>{value.tone === "simple" ? "Simple language" : "Warm language"}</li>
  </ul>;
}

export function ConnectionRituals({ onMemory }: { onMemory: (id: string) => void }) {
  const { state, family, run, busy } = useCompanion();
  const [editing, setEditing] = useState<RitualView | "new" | null>(null);
  const [deleting, setDeleting] = useState<RitualView | null>(null);
  if (!state) return null;
  const data = state.rituals;
  return <div className="ritual-page">
    <nav className="companion-sections" aria-label="Conversation views">
      <Link href="/calls">Family calls</Link><Link href="/rituals" aria-current="page">Connection rituals</Link><Link href="/conversation">Conversation companion</Link>
    </nav>
    <div className="section-heading"><div><span className="section-kicker"><Sparkles size={16} /> A little time for each other</span><h2>Before you say hello</h2></div>
      <button className="button primary" onClick={() => setEditing("new")} disabled={!family.family.cloud_consent}><Plus size={18} /> New ritual</button></div>
    {!family.family.cloud_consent && <p className="ritual-notice">Family AI permission is off. <Link className="text-link" href="/choices">Review my choices</Link></p>}
    {!data.rituals.length && <Empty icon={<Sparkles size={32} />} title="A familiar voice. Something lovely to talk about."><Link className="text-link" href="/family">Your people <ArrowRight size={16} /></Link></Empty>}
    {data.rituals.map(ritual => {
      const recipient = family.members.find(m => m.id === ritual.recipient_id);
      const history = data.runs.filter(r => r.ritualId === ritual.id);
      const active = history.find(r => ["queued", "running"].includes(r.status));
      const proposal = history.find(r => r.task === "learn" && r.status === "ready");
      const prepared = history.find(r => r.task === "prepare" && ["ready", "applied"].includes(r.status));
      const failed = history[0]?.status === "failed" ? history[0] : null;
      return <section className="ritual-section" key={ritual.id} aria-label={`Ritual with ${recipient?.name ?? "relative"}`}>
        <header className="ritual-heading"><div><span className="section-kicker">{ritualSkills[ritual.skill].name}</span><h3>With {recipient?.name ?? "your relative"}</h3>
          <p className="small muted"><Clock3 size={14} /> {cadenceLabels[ritual.cadence]}{!ritual.enabled ? " / Paused" : ""}</p></div>
          <div className="button-row">
            <button className="button secondary" disabled={busy || !!active || !!ritual.unavailable} onClick={() => run({ action: "ritual-run", id: ritual.id })}><Sparkles size={17} /> Prepare now</button>
            <button className="icon-button" title="Edit ritual" aria-label={`Edit ritual with ${recipient?.name}`} disabled={busy} onClick={() => setEditing(ritual)}><Pencil size={18} /></button>
            <button className="icon-button" title={ritual.enabled ? "Pause ritual" : "Resume ritual"} aria-label={ritual.enabled ? "Pause ritual" : "Resume ritual"} disabled={busy} onClick={() => run({ action: "ritual-toggle", id: ritual.id, revision: ritual.revision, enabled: !ritual.enabled })}>{ritual.enabled ? <Pause size={18} /> : <Play size={18} />}</button>
            <button className="icon-button danger" title="Delete ritual" aria-label="Delete ritual" disabled={busy} onClick={() => setDeleting(ritual)}><Trash2 size={18} /></button>
          </div></header>
        {ritual.unavailable && <p className="ritual-notice">{ritual.unavailable}</p>}
        <details className="ritual-permissions"><summary><ShieldCheck size={16} /> My routine and permissions</summary>
          <SkillSummary value={ritual.preferences} />
          <p className="small">{ritual.engine === "hermes" ? "Hermes + NVIDIA Nemotron" : "NVIDIA Nemotron"} / Version {ritual.revision}</p>
          <p className="small">{ritual.sourceIds.length} chosen memories. {ritual.allow_action ? "Actions require my review." : "No action proposals."}</p>
          <p className="small">{ritual.expires_at ? `Permission ends ${displayDate(ritual.expires_at, family.family.timezone)}` : "Until I revoke access"}</p>
          {ritual.next_run_at && <p className="small">Next preparation: {displayDate(ritual.next_run_at, family.family.timezone)}</p>}
          <div className="button-row">{ritual.sourceIds.map(id => <button key={id} className="text-link" onClick={() => onMemory(id)} disabled={!family.memories.some(m => m.id === id)}>{family.memories.find(m => m.id === id)?.title ?? "Unavailable memory"}</button>)}</div>
        </details>
        {ritual.engine === "hermes" && <form className="ritual-teach" onSubmit={async e => {
          e.preventDefault(); const form = e.currentTarget;
          if (await run({ action: "ritual-learn", id: ritual.id, instruction: String(new FormData(form).get("instruction")) })) form.reset();
        }}><label htmlFor={`teach-${ritual.id}`}>Make this routine yours</label><div className="ritual-teach-row"><input id={`teach-${ritual.id}`} name="instruction" placeholder="Just two updates and one question, in simple language" minLength={5} maxLength={500} required /><button className="button secondary" disabled={busy || !!active || !!ritual.unavailable}><Sparkles size={17} /> Suggest changes</button></div></form>}
        {active && <div className="ritual-progress" role="status"><LoaderCircle className="spin" size={19} /><span>{active.task === "learn" ? "Preparing a routine for your review" : "Finding a personal place to begin"}<small>{active.status === "queued" ? "Waiting for the background worker" : active.task === "learn" ? "Reviewing your requested preferences" : "Preparing with your chosen memories"}</small></span><button className="icon-button" title="Cancel preparation" aria-label="Cancel preparation" disabled={busy} onClick={() => run({ action: "ritual-dismiss", id: active.id })}><X size={18} /></button></div>}
        {failed && <p className="error-text" role="alert">{failed.error}</p>}
        {proposal?.skillProposal && <div className="ritual-skill-review"><h4>Your proposed routine</h4><div className="form-two"><div><p className="small muted">Current</p><SkillSummary value={ritual.preferences} /></div><div><p className="small muted">Proposed</p><SkillSummary value={proposal.skillProposal} /></div></div>
          <p className="small muted">Your selected memories, recipient, schedule, and permissions stay unchanged.</p>
          <div className="button-row"><button className="button primary" disabled={busy} onClick={() => run({ action: "ritual-skill-approve", id: proposal.id })}><Check size={17} /> Approve routine</button><button className="button quiet" disabled={busy} onClick={() => run({ action: "ritual-dismiss", id: proposal.id })}>Keep current routine</button></div><Receipt value={proposal} /></div>}
        {prepared?.result && <PreparedCall key={prepared.id} value={prepared} ritual={ritual} onMemory={onMemory} />}
        {!active && !prepared && !proposal && history[0]?.status === "expired" && <p className="small muted">Earlier preparation was cleared after a memory, routine, or permission change.</p>}
      </section>;
    })}
    {editing && <Modal title={editing === "new" ? "A new connection ritual" : "Edit your ritual"} onClose={() => setEditing(null)}><RitualForm existing={editing === "new" ? null : editing} onDone={() => setEditing(null)} /></Modal>}
    {deleting && <Modal title="Delete this ritual?" onClose={() => setDeleting(null)}><p>Its saved routine and preparations will be removed. Original memories and previously sent messages will remain.</p><div className="button-row"><button className="button danger" disabled={busy} onClick={async () => { if (await run({ action: "ritual-delete", id: deleting.id })) setDeleting(null); }}><Trash2 size={17} /> Delete ritual</button><button className="button quiet" onClick={() => setDeleting(null)}>Keep it</button></div></Modal>}
  </div>;
}

function RitualForm({ existing, onDone }: { existing: RitualView | null; onDone: () => void }) {
  const { family, state, run, busy } = useCompanion();
  const [recipientId, setRecipient] = useState(existing?.recipient_id ?? "");
  const [selected, setSelected] = useState(existing?.sourceIds ?? []);
  const [skill, setSkill] = useState<RitualSettings["skill"]>(existing?.skill ?? "call");
  const recipient = family.members.find(m => m.id === recipientId);
  const memories = family.memories.filter(m => m.status === "approved" && m.caption.trim() && (!m.expires_at || m.expires_at > family.now) && (m.author_id === recipientId || JSON.parse(m.person_ids).includes(recipient?.person_id)));
  return <form className="form-stack" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const days = Number(form.get("expiry"));
    if (await run({ action: "ritual-save", ...(existing ? { id: existing.id, revision: existing.revision } : {}),
      skill, recipientId, sourceIds: selected, cadence: String(form.get("cadence")) as RitualSettings["cadence"],
      engine: String(form.get("engine")) as RitualSettings["engine"], allowAction: form.has("allowAction"),
      expiresAt: days === -1 ? existing?.expires_at ?? null : days ? Date.now() + days * 86400000 : null })) onDone();
  }}>
    <label>Who is this time for?<select required value={recipientId} onChange={e => { setRecipient(e.target.value); setSelected([]); }}><option value="">Choose a relative</option>{family.members.filter(m => m.id !== family.member.id && m.active && m.person_id && (!m.expires_at || m.expires_at > family.now)).map(m => <option key={m.id} value={m.id}>{m.name} / {m.relationship_label}</option>)}</select></label>
    <label>Our ritual<select value={skill} onChange={e => setSkill(e.target.value as RitualSettings["skill"])}>{Object.entries(ritualSkills).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
    <label>Prepare with<select key={skill} name="engine" defaultValue={skill === "call" && state?.rituals.runtime.hermes.available ? existing?.engine ?? "hermes" : "direct"}><option value="direct">NVIDIA Nemotron</option>{skill === "call" && state?.rituals.runtime.hermes.available && <option value="hermes">Hermes + NVIDIA Nemotron</option>}</select></label>
    <fieldset className="ritual-source-list"><legend>Memories I allow ({selected.length}/12)</legend>{memories.map(m => <label className="check-label" key={m.id}><input type="checkbox" checked={selected.includes(m.id)} disabled={!selected.includes(m.id) && selected.length >= 12} onChange={e => setSelected(e.target.checked ? [...selected, m.id] : selected.filter(id => id !== m.id))} /><span>{m.title}</span></label>)}{!memories.length && <p className="small muted">No approved memories for this relative yet.</p>}</fieldset>
    <div className="form-two"><label>When<select name="cadence" defaultValue={existing?.cadence ?? "manual"}>{Object.entries(cadenceLabels).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label>Permission expires<select name="expiry" defaultValue={existing ? "-1" : "30"}>{existing && <option value="-1">Keep current expiry</option>}<option value="7">In 7 days</option><option value="30">In 30 days</option><option value="0">When I revoke it</option></select></label></div>
    <label className="check-label"><input name="allowAction" type="checkbox" defaultChecked={!!existing?.allow_action} />{skill === "story" ? "Offer a private memory walk for my approval" : "Offer a reply for my approval"}</label>
    <p className="small muted">Selected captions and family names are sent to Nemotron on Nebius. No automatic sending. New memories are not included until you select them.</p>
    <button className="button primary" disabled={busy || !selected.length || !family.family.cloud_consent}><Check size={17} /> Save ritual</button>
  </form>;
}

function PreparedCall({ value, ritual, onMemory }: { value: RunView; ritual: RitualView; onMemory: (id: string) => void }) {
  const { family, run, busy } = useCompanion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(value.result!.proposal.text);
  const [review, setReview] = useState(false);
  const result = value.result!;
  const moment = result.moments[index];
  const source = family.memories.find(m => m.id === moment.sourceId);
  const recipient = family.members.find(m => m.id === ritual.recipient_id);
  return <div className="prepared-ritual">
    <div className="section-heading"><div><span className="section-kicker">{value.provider === "fixture" ? "Offline preview / not AI generated" : value.provider === "hermes-nebius" ? "Prepared with Hermes + Nemotron" : "Prepared with Nemotron"}</span><h4>{result.title}</h4></div><LocalReadAloud language={family.family.language} text={`${moment.caption} ${moment.question}`} /></div>
    <div className={`ritual-moment ${source?.kind === "photo" && source.media_id ? "has-photo" : ""}`}>
      {source?.kind === "photo" && source.media_id && <Image unoptimized loading="eager" src={`/api/media/${source.media_id}`} width={400} height={300} alt={source.title} />}
      <div><p className="ritual-caption">{moment.caption}</p>{moment.question && <blockquote>{moment.question}</blockquote>}<details><summary>{moment.evidenceId ? "Reviewed photo details" : "Original words"}</summary><p className="small">{moment.quote}</p><button className="text-link" onClick={() => onMemory(moment.sourceId)}>Open memory <ArrowRight size={15} /></button></details></div>
    </div>
    <div className="ritual-pager"><button className="icon-button" aria-label="Previous prepared memory" title="Previous memory" disabled={!index} onClick={() => setIndex(index - 1)}><ArrowLeft size={18} /></button><span aria-live="polite">{index + 1} / {result.moments.length}</span><button className="icon-button" aria-label="Next prepared memory" title="Next memory" disabled={index === result.moments.length - 1} onClick={() => setIndex(index + 1)}><ArrowRight size={18} /></button></div>
    {value.status === "applied" ? <p className="success-note"><Check size={17} />{result.proposal.tool === "reply.offer" ? `Sent to ${recipient?.name}'s Togetherly inbox.` : "Your private memory walk is ready."} <Link className="text-link" href={result.proposal.tool === "reply.offer" ? "/messages" : "/walks"}>Open <ArrowRight size={15} /></Link></p> : result.proposal.tool !== "none" && <div className="ritual-action"><label htmlFor={`reply-${value.id}`}>{result.proposal.tool === "reply.offer" ? `A reply to ${recipient?.name}` : "Your memory walk"}</label><textarea id={`reply-${value.id}`} value={text} maxLength={result.proposal.tool === "reply.offer" ? 1500 : 200} onChange={e => { setText(e.target.value); setReview(false); }} rows={3} /><button className="button primary" disabled={busy || !text.trim()} onClick={() => setReview(true)}>{result.proposal.tool === "reply.offer" ? <Send size={17} /> : <Play size={17} />} {result.proposal.tool === "reply.offer" ? "Review reply" : "Review memory walk"}</button></div>}
    <Receipt value={value} />
    {review && <Modal title={result.proposal.tool === "reply.offer" ? `Send to ${recipient?.name}?` : "Create this private walk?"} onClose={() => setReview(false)}><p className="ritual-review-text">{text}</p><p className="small muted">{result.proposal.tool === "reply.offer" ? "Delivered only to their Togetherly inbox." : `${result.proposal.sourceIds.length} chosen memories, visible only to you.`}</p><div className="button-row"><button className="button primary" disabled={busy} onClick={async () => { if (await run({ action: "ritual-approve", id: value.id, text })) setReview(false); }}><Check size={17} />{result.proposal.tool === "reply.offer" ? "Approve and send" : "Approve and create"}</button><button className="button quiet" disabled={busy} onClick={() => setReview(false)}>Keep editing</button></div></Modal>}
  </div>;
}

function Receipt({ value }: { value: RunView }) {
  const { family } = useCompanion();
  return <details className="ritual-receipt"><summary><ShieldCheck size={16} /> Preparation record</summary><p className="small muted">{displayDate(value.createdAt, family.family.timezone)}{value.model ? ` / ${value.model}` : ""}</p><ol>{value.receipt.map((step, i) => <li key={i}><code>{step.tool}</code><span>{step.status === "awaiting-approval" ? value.status === "applied" ? "Reviewed" : "Needs approval" : "Completed"}</span></li>)}</ol><p className="small muted">{value.sources.length} selected source references. Preparation expires {displayDate(value.expiresAt, family.family.timezone)}.</p></details>;
}
