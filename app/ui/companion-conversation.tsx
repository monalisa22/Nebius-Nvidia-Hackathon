"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Heart, Phone, X } from "lucide-react";
import { Avatar, Empty } from "./primitives";
import { CompanionLoading, useCompanion } from "./companion-context";
import { preparedMemory } from "@/lib/anubandh/briefs";

export function ConversationCompanion({
  initialPersonId,
  onMemory,
  onReply,
}: {
  initialPersonId?: string;
  onMemory: (id: string) => void;
  onReply: (id: string) => void;
}) {
  const { state, family, run, busy } = useCompanion();
  const [selected, setSelected] = useState(
    initialPersonId ||
      state?.sessions.find((s) => !s.ended_at)?.person_id ||
      family.people[0]?.id ||
      "",
  );
  const [recorded, setRecorded] = useState(false);
  if (!state) return <CompanionLoading />;
  const person = family.people.find((p) => p.id === selected);
  const session = state.sessions.find(
    (s) => s.person_id === selected && !s.ended_at,
  );
  const memories = family.memories
    .filter(
      (m) =>
        m.status === "approved" &&
        (!m.expires_at || m.expires_at > family.now) &&
        JSON.parse(m.person_ids).includes(selected),
    )
    .slice(0, 6);
  const facts = state.facts.filter(
    (f) => f.person_id === selected && f.status === "approved",
  );
  const prepared = family.artifacts.filter((a) => a.kind === "call" && family.calls.some(
    (c) => c.id === a.call_id && c.person_id === selected,
  ));
  const peer = family.members.find(
    (m) =>
      m.person_id === selected &&
      m.active &&
      (!m.expires_at || m.expires_at > family.now),
  );
  return (
    <section
      className={`conversation-space ${session ? "conversation-active" : ""}`}
    >
      <div className="section-heading">
        <Link className="text-link" href="/calls">
          <ArrowLeft size={16} />
          Family calls
        </Link>
        <label className="compact-field">
          Talking with
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setRecorded(false);
            }}
          >
            {family.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {person ? (
        <>
          <div className="conversation-person">
            <Avatar src={person.avatar} name={person.name} />
            <div>
              <span className="section-kicker">
                {session
                  ? "Alongside your conversation"
                  : "A familiar place to begin"}
              </span>
              <h2>{person.name}</h2>
              <p>{person.relationship_label ?? person.relationship}</p>
              <p>{person.about}</p>
            </div>
            <div className="button-row">
              {session ? (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => run({ action: "session-end", id: session.id })}
                >
                  <X size={17} />
                  End companion
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    run({ action: "session-start", personId: selected })
                  }
                >
                  <Phone size={17} />
                  Start companion
                </button>
              )}
              {peer && (
                <button
                  className="button secondary"
                  onClick={() => onReply(peer.id)}
                >
                  Send a reply
                </button>
              )}
            </div>
          </div>
          <div className="conversation-columns">
            <section>
              <h3>Something to ask about</h3>
              {memories.map((m) => {
                const brief = preparedMemory(prepared, m.id);
                return (
                <article className="conversation-prompt" key={m.id}>
                  <span className="section-kicker">From your family</span>
                  <h3>{m.title}</h3>
                  <p>{brief?.text ?? m.caption}</p>
                  {brief?.starters?.map((starter) => <p key={starter}>{starter}</p>)}
                  <button className="text-link" onClick={() => onMemory(m.id)}>
                    Original memory <ArrowRight size={16} />
                  </button>
                </article>
              );
              })}
              {!memories.length && (
                <Empty
                  icon={<Heart size={30} />}
                  title="Your approved moments will appear here"
                >
                  <Link href="/memories" className="button secondary">
                    Family memories
                  </Link>
                </Empty>
              )}
            </section>
            <section>
              <h3>What matters to {person.name}</h3>
              {facts.map((f) => (
                <article className="fact-card" key={f.id}>
                  <p>{f.quote}</p>
                  <button
                    className="text-link"
                    onClick={() => onMemory(f.source_id)}
                  >
                    View source <ArrowRight size={14} />
                  </button>
                </article>
              ))}
              {!facts.length && (
                <p className="muted">No personal details approved yet.</p>
              )}
              {peer && (
                <div className="conversation-checkout">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await run({
                          action: "connection-log",
                          peerId: peer.id,
                          kind: "call",
                          happenedAt: Date.now(),
                        })
                      )
                        setRecorded(true);
                    }}
                  >
                    <Check size={17} />
                    We spoke today
                  </button>
                  {recorded && (
                    <p role="status" className="success-note">
                      A little time together, remembered.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <Empty
          icon={<Heart size={32} />}
          title="Choose someone from your family"
        >
          <Link href="/family" className="button secondary">
            Your people
          </Link>
        </Empty>
      )}
    </section>
  );
}
