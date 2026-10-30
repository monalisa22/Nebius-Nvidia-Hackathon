"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  GitBranch,
  Heart,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { Memory, Person } from "@/lib/anubandh/types";
import { Avatar, Empty, Modal } from "./primitives";
import {
  CompanionFeedback,
  CompanionLoading,
  displayDate,
  useCompanion,
} from "./companion-context";

const categoryNames = {
  interest: "An interest",
  milestone: "A milestone",
  birthday: "A birthday",
  stated_feeling: "In their words",
};
export function PeopleSections({ current }: { current: string }) {
  return (
    <nav className="companion-sections" aria-label="Your people views">
      <Link
        href="/family"
        aria-current={current === "family" ? "page" : undefined}
      >
        <Heart size={18} />
        Your people
      </Link>
      <Link
        href="/family-tree"
        aria-current={current === "family-tree" ? "page" : undefined}
      >
        <GitBranch size={18} />
        Family connections
      </Link>
      <Link
        href="/insights"
        aria-current={current === "insights" ? "page" : undefined}
      >
        <Sparkles size={18} />
        What matters
      </Link>
    </nav>
  );
}
export function PersonCompanion({
  person,
  onMemory,
  onReply,
}: {
  person: Person;
  onMemory: (id: string) => void;
  onReply: (id: string) => void;
}) {
  const { state, family, busy, run } = useCompanion();
  const [open, setOpen] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const connection = state?.connections.find((c) => c.personId === person.id);
  const facts =
    state?.facts.filter(
      (f) => f.person_id === person.id && f.status === "approved",
    ) ?? [];
  return (
    <>
      <button
        className="person-companion-link"
        onClick={() => {
          setOpen(true);
          setRecorded(false);
        }}
      >
        <Heart size={17} />
        <span>What matters to {person.name}</span>
        <ArrowRight size={16} />
      </button>
      {open && (
        <Modal
          title={`A little closer to ${person.name}`}
          onClose={() => setOpen(false)}
          wide
        >
          <div className="person-introduction">
            <Avatar src={person.avatar} name={person.name} />
            <div>
              <h3>{person.name}</h3>
              <p>{person.relationship_label ?? person.relationship}</p>
            </div>
          </div>
          <p>{person.about}</p>
          {connection && (
            <div className="connection-note">
              <span className="section-kicker">Your connection</span>
              <p>
                {connection.lastConnectedAt
                  ? `Last recorded connection: ${displayDate(connection.lastConnectedAt, family.family.timezone)}`
                  : "No connection recorded here yet."}
              </p>
              {connection.reminder && <p>{connection.reminder}</p>}
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await run({
                        action: "connection-log",
                        peerId: connection.memberId,
                        kind: "call",
                        happenedAt: Date.now(),
                      })
                    )
                      setRecorded(true);
                  }}
                >
                  <Check size={16} />
                  We spoke today
                </button>
                <button
                  className="button quiet"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await run({
                        action: "connection-log",
                        peerId: connection.memberId,
                        kind: "visit",
                        happenedAt: Date.now(),
                      })
                    )
                      setRecorded(true);
                  }}
                >
                  We met today
                </button>
              </div>
              {recorded && (
                <p className="success-note" role="status">
                  Your connection has been recorded.
                </p>
              )}
            </div>
          )}
          <h3>Things that matter</h3>
          <div className="facts-grid">
            {facts.map((fact) => (
              <article className="fact-card" key={fact.id}>
                <span className="section-kicker">
                  {categoryNames[fact.category]}
                </span>
                <p>{fact.quote}</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setOpen(false);
                    onMemory(fact.source_id);
                  }}
                >
                  From a family memory <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
          {!facts.length && (
            <p className="muted">No approved personal details yet.</p>
          )}
          <div className="button-row">
            <Link
              className="button primary"
              href={`/conversation?person=${person.id}`}
            >
              <Video size={17} />
              Conversation companion
            </Link>
            {connection && (
              <button
                className="button secondary"
                onClick={() => {
                  setOpen(false);
                  onReply(connection.memberId);
                }}
              >
                <MessageCircle size={17} />
                Send a reply
              </button>
            )}
          </div>
          <CompanionFeedback />
        </Modal>
      )}
    </>
  );
}

export function FamilyTree({
  onMemory,
  onReply,
}: {
  onMemory: (id: string) => void;
  onReply: (id: string) => void;
}) {
  const { state, family, run, busy } = useCompanion();
  const [adding, setAdding] = useState(false);
  if (!state) return <CompanionLoading />;
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await run({
        action: "link-add",
        fromId: String(form.get("from")),
        toId: String(form.get("to")),
        kind: form.get("kind") as "parent" | "partner" | "sibling",
      })
    )
      setAdding(false);
  }
  return (
    <>
      <PeopleSections current="family-tree" />
      <div className="section-heading">
        <h2>The threads between us</h2>
        {family.member.role === "primary" && (
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add a connection
          </button>
        )}
      </div>
      <div className="family-tree">
        {state.links.map((link) => {
          const from = family.people.find((p) => p.id === link.from_id);
          const to = family.people.find((p) => p.id === link.to_id);
          if (!from || !to) return null;
          return (
            <article className="family-branch" key={link.id}>
              <div>
                <Avatar src={from.avatar} name={from.name} />
                <h3>{from.name}</h3>
                <PersonCompanion
                  person={from}
                  onMemory={onMemory}
                  onReply={onReply}
                />
              </div>
              <span className="branch-relation">
                <GitBranch size={24} />
                {link.kind === "parent"
                  ? "Parent of"
                  : link.kind === "partner"
                    ? "Partner of"
                    : "Sibling of"}
              </span>
              <div>
                <Avatar src={to.avatar} name={to.name} />
                <h3>{to.name}</h3>
                <PersonCompanion
                  person={to}
                  onMemory={onMemory}
                  onReply={onReply}
                />
              </div>
              {family.member.role === "primary" && (
                <button
                  className="icon-button danger"
                  title="Remove connection"
                  aria-label={`Remove connection between ${from.name} and ${to.name}`}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Remove this family connection?"))
                      void run({ action: "link-delete", id: link.id });
                  }}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!state.links.length && (
        <Empty
          icon={<GitBranch size={36} />}
          title="Every family has its own story"
        >
          <p>Your confirmed family connections will appear here.</p>
          {family.member.role === "primary" && (
            <button
              className="button secondary"
              onClick={() => setAdding(true)}
            >
              Add your first connection
            </button>
          )}
        </Empty>
      )}
      {adding && (
        <Modal title="A family connection" onClose={() => setAdding(false)}>
          <form className="form-stack" onSubmit={add}>
            <label>
              Person
              <select name="from" required>
                <option value="">Choose someone</option>
                {family.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Relationship
              <select name="kind">
                <option value="parent">Is a parent of</option>
                <option value="partner">Is a partner of</option>
                <option value="sibling">Is a sibling of</option>
              </select>
            </label>
            <label>
              Related person
              <select name="to" required>
                <option value="">Choose someone</option>
                {family.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <CompanionFeedback />
            <button className="button primary" disabled={busy}>
              <Check size={17} />
              Save connection
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function WhatMatters({ onMemory }: { onMemory: (id: string) => void }) {
  const { state, family, busy, run } = useCompanion();
  const [filter, setFilter] = useState("approved");
  const [personId, setPersonId] = useState("");
  if (!state) return <CompanionLoading />;
  const primary = family.member.role === "primary";
  const facts = state.facts.filter(
    (f) => f.status === filter && (!personId || f.person_id === personId),
  );
  return (
    <>
      <PeopleSections current="insights" />
      <div className="section-heading">
        <div>
          <span className="section-kicker">Small things, remembered</span>
          <h2>What matters to your people</h2>
        </div>
        <label className="compact-field">
          Person
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="">Everyone</option>
            {family.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="segments">
        {["approved", "pending", "rejected"].map((status) => (
          <button
            key={status}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === "approved"
              ? "Remembered"
              : status === "pending"
                ? "For review"
                : "Declined"}
            {status === "pending" &&
            state.facts.some((f) => f.status === "pending")
              ? ` (${state.facts.filter((f) => f.status === "pending").length})`
              : ""}
          </button>
        ))}
      </div>
      <div className="facts-grid">
        {facts.map((fact) => (
          <article className="fact-card" key={fact.id}>
            <div className="section-kicker">
              {family.people.find((p) => p.id === fact.person_id)?.name} ·{" "}
              {categoryNames[fact.category]}
            </div>
            <p>{fact.quote}</p>
            <button
              className="text-link"
              onClick={() => onMemory(fact.source_id)}
            >
              View original memory <ArrowRight size={14} />
            </button>
            {fact.category === "stated_feeling" &&
              fact.status === "pending" && (
                <p className="small muted">
                  Approve only if this is an explicit account of how this person
                  says they feel.
                </p>
              )}
            {primary && (
              <div className="button-row">
                {fact.status !== "approved" && (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      run({
                        action: "fact-review",
                        id: fact.id,
                        decision: "approved",
                      })
                    }
                  >
                    <Check size={16} />
                    Approve detail
                  </button>
                )}
                {fact.status === "pending" && (
                  <button
                    className="button quiet"
                    disabled={busy}
                    onClick={() =>
                      run({
                        action: "fact-review",
                        id: fact.id,
                        decision: "rejected",
                      })
                    }
                  >
                    <X size={16} />
                    Decline
                  </button>
                )}
                <button
                  className="icon-button danger"
                  title="Delete detail"
                  aria-label="Delete detail"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this personal detail?"))
                      void run({ action: "fact-delete", id: fact.id });
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!facts.length && (
        <Empty
          icon={<Heart size={32} />}
          title={
            filter === "pending"
              ? "Nothing waiting for review"
              : "A little more to discover"
          }
        >
          <Link className="button secondary" href="/memories">
            Visit family memories <ArrowRight size={17} />
          </Link>
        </Empty>
      )}
    </>
  );
}

export function MemoryEnrichment({ memory }: { memory: Memory }) {
  const { state, family, run, busy } = useCompanion();
  const [saved, setSaved] = useState("");
  const [editRevision, setEditRevision] = useState(memory.revision);
  if (!state || memory.status !== "approved") return null;
  const details = state.memoryContext.find((m) => m.source_id === memory.id);
  const primary = family.member.role === "primary";
  const tags = family.people.filter((p) =>
    JSON.parse(memory.person_ids).includes(p.id),
  );
  const jobs = state.jobs.filter((j) => j.source_id === memory.id);
  const activeJob = jobs.find(
    (j) => j.status === "queued" || j.status === "running",
  );
  return (
    <section className="memory-enrichment">
      {details?.occurred_on && (
        <p className="small muted">
          Remembered date: {details.occurred_on}
          {details.place ? ` · ${details.place}` : ""}
        </p>
      )}
      {primary && (
        <details>
          <summary>Story details</summary>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const result = await run({
                action: "memory-context",
                sourceId: memory.id,
                revision: editRevision,
                occurredOn: String(form.get("date")) || null,
                place: String(form.get("place")),
                legacy: form.has("legacy"),
              });
              if (result) {
                setEditRevision(editRevision + 1);
                setSaved("Story details saved.");
              }
            }}
          >
            <div className="form-two">
              <label>
                When this happened
                <input
                  type="date"
                  name="date"
                  defaultValue={details?.occurred_on ?? ""}
                />
              </label>
              <label>
                Place
                <input
                  name="place"
                  defaultValue={details?.place ?? ""}
                  maxLength={200}
                />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                name="legacy"
                defaultChecked={Boolean(details?.legacy)}
              />
              Keep in Family stories
            </label>
            <button className="button secondary" disabled={busy}>
              Save story details
            </button>
          </form>
        </details>
      )}
      {!!tags.length && (
        <details>
          <summary>Things worth remembering</summary>
          <p className="small muted">
            Personal details stay linked to this memory and are reviewed before
            sharing.
          </p>
          {family.family.cloud_consent ? (
            <button
              className="button secondary"
              disabled={busy || Boolean(activeJob)}
              onClick={async () => {
                if (
                  window.confirm(
                    "Let Nemotron on Nebius read this approved caption and tagged family names to suggest personal details for review?",
                  )
                ) {
                  if (await run({ action: "extract", sourceId: memory.id }))
                    setSaved("Suggestions queued for review.");
                }
              }}
            >
              <Sparkles size={17} />
              {activeJob ? "Preparing suggestions" : "Find personal details"}
            </button>
          ) : (
            <Link className="text-link" href="/choices">
              Choose AI permissions <ArrowRight size={16} />
            </Link>
          )}
          {activeJob && (
            <button
              className="button quiet"
              disabled={busy}
              onClick={() =>
                run({ action: "extraction-cancel", id: activeJob.id })
              }
            >
              Cancel preparation
            </button>
          )}
          {jobs[0]?.status === "failed" && (
            <p role="alert" className="error-text">
              {jobs[0].error}
            </p>
          )}
          {jobs[0]?.status === "completed" && (
            <p className="small muted" role="status">
              {jobs[0].provider === "token-factory"
                ? "Nemotron preparation complete."
                : "Offline preparation complete."}{" "}
              {state.facts.some(
                (f) => f.source_id === memory.id && f.status === "pending",
              )
                ? "Personal details are ready for review."
                : "No new personal details are waiting for review."}
            </p>
          )}
          <Link href="/insights" className="text-link">
            Review personal details <ArrowRight size={16} />
          </Link>
          {(primary || family.member.can_contribute === 1) && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                if (
                  await run({
                    action: "fact-propose",
                    sourceId: memory.id,
                    fact: {
                      personId: String(form.get("person")),
                      category: form.get("category") as
                        | "interest"
                        | "milestone"
                        | "birthday"
                        | "stated_feeling",
                      quote: String(form.get("quote")),
                    },
                  })
                )
                  setSaved("Personal detail saved for review.");
              }}
            >
              <label>
                Person
                <select name="person">
                  {tags.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Remember as
                <select name="category">
                  {Object.entries(categoryNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Exact words from this memory
                <textarea name="quote" required maxLength={1000} rows={3} />
              </label>
              <button className="button secondary" disabled={busy}>
                <Plus size={17} />
                Save detail for review
              </button>
            </form>
          )}
        </details>
      )}
      {saved && (
        <p className="success-note" role="status">
          {saved}
        </p>
      )}
      <CompanionFeedback />
    </section>
  );
}
