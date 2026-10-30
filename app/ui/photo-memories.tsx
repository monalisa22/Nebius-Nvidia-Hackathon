"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Footprints, ImagePlus, LoaderCircle, Pencil, ScanEye, Sparkles, X } from "lucide-react";
import type { Memory } from "@/lib/anubandh/types";
import { photoThemes, type PhotoResult } from "@/lib/togetherly/photo-contracts";
import { CompanionFeedback, useCompanion } from "./companion-context";
import { Modal } from "./primitives";

function Photo({ memory, className = "" }: { memory: Memory; className?: string }) {
  const [failed, setFailed] = useState(false);
  return !failed && memory.media_id ? <Image unoptimized src={`/api/media/${memory.media_id}`} width={900} height={650}
    className={className} alt={memory.title} onError={() => setFailed(true)} /> :
    <div className={`photo-unavailable ${className}`}><ImagePlus size={30} /><span>Photograph unavailable</span></div>;
}

export function PhotoPermission() {
  const { state, family, run, busy } = useCompanion();
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  if (!state) return null;
  return <section className="settings-section photo-permission">
    <div className="settings-title"><ScanEye size={24} /><div><h2>A little more from your photographs</h2><p>Photo processing is {state.photos.enabled ? "allowed" : "off"}.</p></div></div>
    <p>Selected photos and their stories can be sent to NVIDIA Nemotron on Nebius. Suggestions need family review before they appear in briefings and collections.</p>
    {family.member.role === "primary" ? <label className="check-label">
      <input type="checkbox" checked={pendingEnabled ?? state.photos.enabled} disabled={busy || pendingEnabled !== null || !family.family.cloud_consent}
        onChange={async e => {
          const enabled = e.target.checked;
          setPendingEnabled(enabled);
          await run({ action: "photo-permission", enabled });
          setPendingEnabled(null);
        }} />
      Allow AI for photographs we choose
    </label> : <p className="small muted">The primary family member manages this permission.</p>}
    {!family.family.cloud_consent && <p className="small muted">Enable family AI processing first.</p>}
    <p className="small muted">Turning this off cancels photo analysis and removes photo-derived details. Your original stories and photographs remain.</p>
    <p className="small muted">Daily photo analysis limit: {state.photos.dailyLimit} per family.</p>
    <CompanionFeedback />
  </section>;
}

export function PhotoInsights({ memory }: { memory: Memory }) {
  const { state, family, run, busy } = useCompanion();
  const [editing, setEditing] = useState(false);
  if (!state || memory.kind !== "photo") return null;
  const analysis = state.photos.analyses.find(a => a.sourceId === memory.id);
  const primary = family.member.role === "primary";
  const canRequest = primary || (memory.author_id === family.member.id && Boolean(family.member.can_contribute));
  const pending = analysis && ["queued", "running"].includes(analysis.status);
  const content = analysis?.content;
  return <section className="photo-insights" aria-label="Photo insights">
    <div className="photo-section-title"><ScanEye size={21} /><h3>A little more to remember</h3></div>
    {memory.status !== "approved" ? <p className="small muted">Photo suggestions become available after this memory is approved.</p> :
      !state.photos.enabled ? <Link className="text-link" href="/choices">Choose photo AI permissions <ArrowRight size={16} /></Link> : <>
        {!analysis || ["failed", "cancelled"].includes(analysis.status) ? <>
          {canRequest && <button className="button secondary" disabled={busy} onClick={() => void run({ action: "photo-analyze", sourceId: memory.id })}>
            <Sparkles size={17} />{analysis ? "Retry photo suggestions" : "Explore this photo"}</button>}
          {analysis?.error && <p className="error-text" role="alert">{analysis.error}</p>}
        </> : null}
        {pending && <div className="photo-processing" role="status"><LoaderCircle className="spin" size={20} /><span>Looking for details worth sharing</span>
          {canRequest && <button className="icon-button" title="Cancel photo analysis" aria-label="Cancel photo analysis" disabled={busy} onClick={() => void run({ action: "photo-cancel", id: analysis.id })}><X size={17} /></button>}</div>}
        {analysis?.status === "dismissed" && <p className="small muted">Photo suggestions dismissed. Your original story is unchanged.</p>}
        {content && <>
          <p className="section-kicker">{analysis.provider === "fixture" ? "Offline preview / not image analysis" : analysis.status === "approved" ? "Photo details reviewed by family" : "Photo suggestions awaiting review"}</p>
          {primary && (analysis.status === "ready" || editing) ? <form className="form-stack" key={`${analysis.id}:${analysis.revision}`} onSubmit={async e => {
            e.preventDefault(); const form = new FormData(e.currentTarget);
            const updated: PhotoResult = { description: String(form.get("description")), observations: String(form.get("observations")).split("\n").map(s => s.trim()).filter(Boolean),
              themes: form.getAll("theme") as PhotoResult["themes"], storyPrompt: String(form.get("prompt")) };
            if (await run({ action: "photo-review", id: analysis.id, revision: analysis.revision, content: updated })) setEditing(false);
          }}>
            <label>Photo description<textarea name="description" defaultValue={content.description} maxLength={600} required rows={3} /></label>
            <label>Visible details<textarea name="observations" defaultValue={content.observations.join("\n")} maxLength={1004} rows={3} /></label>
            <label>A question to share<input name="prompt" defaultValue={content.storyPrompt} maxLength={220} required /></label>
            <fieldset className="photo-theme-options"><legend>Belongs in</legend>{Object.entries(photoThemes).map(([theme, label]) => <label className="check-label" key={theme}>
              <input type="checkbox" name="theme" value={theme} defaultChecked={content.themes.includes(theme as keyof typeof photoThemes)} />{label}</label>)}</fieldset>
            <p className="small muted">Confirm only what you know. These details stay separate from the original family story.</p>
            <div className="button-row"><button className="button primary" disabled={busy}><Check size={17} />Keep reviewed details</button>
              <button type="button" className="button quiet" disabled={busy} onClick={() => void run({ action: "photo-dismiss", id: analysis.id, revision: analysis.revision })}><X size={17} />Dismiss</button></div>
          </form> : <div className="photo-reviewed">
            <p>{content.description}</p>
            {!!content.observations.length && <ul>{content.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
            <blockquote>{content.storyPrompt}</blockquote>
            {!!content.themes.length && <p className="small muted">{content.themes.map(t => photoThemes[t]).join(" · ")}</p>}
            {primary && <div className="button-row"><button className="text-link" onClick={() => setEditing(true)}><Pencil size={16} />Edit photo details</button>
              <button className="text-link" disabled={busy} onClick={() => void run({ action: "photo-dismiss", id: analysis.id, revision: analysis.revision })}><X size={16} />Remove photo details</button></div>}
          </div>}
        </>}
      </>}
    <CompanionFeedback />
  </section>;
}

export function PhotoCollections({ onMemory }: { onMemory: (id: string) => void }) {
  const { state, family, run, busy } = useCompanion();
  const router = useRouter();
  const rail = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [walkTitle, setWalkTitle] = useState("");
  if (!state) return null;
  const collections = state.photos.collections;
  const collection = collections.find(c => c.theme === selected);
  const memories = collection?.sourceIds.flatMap(id => family.memories.find(m => m.id === id) ?? []) ?? [];
  const index = Math.min(position, Math.max(0, memories.length - 1));
  const memory = memories[index];
  const details = state.photos.analyses.find(a => a.sourceId === memory?.id)?.content;
  const previous = () => setPosition(Math.max(0, index - 1));
  const next = () => setPosition(Math.min(memories.length - 1, index + 1));
  return <section className="photo-collections" aria-label="Shared threads">
    <div className="story-heading"><div><span className="section-kicker">Little moments, connected</span><h2>Threads of our lives</h2></div>
      {collections.length > 1 && <div className="button-row"><button className="icon-button" title="Previous collections" aria-label="Previous collections" onClick={() => rail.current?.scrollBy({ left: -320, behavior: "smooth" })}><ArrowLeft size={18} /></button>
        <button className="icon-button" title="Next collections" aria-label="Next collections" onClick={() => rail.current?.scrollBy({ left: 320, behavior: "smooth" })}><ArrowRight size={18} /></button></div>}</div>
    {!collections.length ? <div className="photo-collections-empty"><ScanEye size={25} /><p>Your reviewed photo themes will gather here.</p>
      {!state.photos.enabled && <Link className="text-link" href="/choices">Photo choices <ArrowRight size={16} /></Link>}</div> :
      <div className="photo-collection-rail" ref={rail}>{collections.map(c => {
        const cover = family.memories.find(m => m.id === c.sourceIds[0]);
        if (!cover) return null;
        return <button className="photo-collection" key={c.theme} onClick={() => { setSelected(c.theme); setPosition(0); setWalkTitle(c.title); }}>
          <Photo key={cover.media_id} memory={cover} /><span className="photo-collection-copy"><span>{c.sourceIds.length} {c.sourceIds.length === 1 ? "memory" : "memories"}</span><strong>{c.title}</strong><ArrowRight size={19} /></span>
        </button>;
      })}</div>}
    {selected && <Modal title={collection?.title ?? "Collection unavailable"} onClose={() => setSelected(null)} wide>
      {memory ? <div className="photo-collection-view" tabIndex={0} aria-label="Collection photographs" onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); previous(); }
      }} onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={e => {
        const start = touch.current; touch.current = null;
        if (!start || (e.target as HTMLElement).closest("input,textarea,button")) return;
        const delta = start.x - e.changedTouches[0].clientX;
        const vertical = start.y - e.changedTouches[0].clientY;
        if (Math.abs(delta) > 60 && Math.abs(delta) > Math.abs(vertical) * 1.5) { if (delta > 0) next(); else previous(); }
      }}>
        <Photo key={memory.media_id} memory={memory} className="photo-collection-hero" />
        <div className="photo-collection-controls"><button className="icon-button" title="Previous photograph" aria-label="Previous photograph" disabled={!index} onClick={previous}><ArrowLeft size={20} /></button>
          <span aria-live="polite">{index + 1} of {memories.length}</span>
          <button className="icon-button" title="Next photograph" aria-label="Next photograph" disabled={index >= memories.length - 1} onClick={next}><ArrowRight size={20} /></button></div>
        <h3>{memory.title}</h3><p>{memory.caption || details?.description}</p>
        {details?.storyPrompt && <blockquote>{details.storyPrompt}</blockquote>}
        <button className="text-link" onClick={() => { setSelected(null); onMemory(memory.id); }}>Open original story <ArrowRight size={16} /></button>
        <form className="photo-walk-form form-stack" onSubmit={async e => {
          e.preventDefault(); const result = await run({ action: "walk-create", title: walkTitle, sourceIds: memories.slice(0, 30).map(m => m.id) });
          if (result) { setSelected(null); router.push("/walks"); }
        }}><label>Name your walk<input value={walkTitle} onChange={e => setWalkTitle(e.target.value)} maxLength={200} required /></label>
          <button className="button primary" disabled={busy}><Footprints size={18} />Create memory walk</button>
          {memories.length > 30 && <p className="small muted">The first 30 memories will be included.</p>}
        </form>
      </div> : <p>These photographs are no longer available.</p>}
      <CompanionFeedback />
    </Modal>}
  </section>;
}
