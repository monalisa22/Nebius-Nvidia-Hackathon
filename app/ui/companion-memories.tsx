"use client";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookHeart,
  Check,
  Footprints,
  Heart,
  Mic,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { Memory } from "@/lib/anubandh/types";
import type { Activity } from "@/lib/togetherly/contracts";
import {
  CompanionFeedback,
  CompanionLoading,
  MemorySections,
  useCompanion,
} from "./companion-context";
import { Empty, LocalReadAloud, Modal } from "./primitives";

export type AddStory = (kind?: Memory["kind"], personId?: string) => void;
export function FamilyStories({
  onMemory,
  onAdd,
}: {
  onMemory: (id: string) => void;
  onAdd: AddStory;
}) {
  const { family, state } = useCompanion();
  if (!state) return <CompanionLoading />;
  const stories = family.memories.filter(
    (m) =>
      m.status === "approved" &&
      (!m.expires_at || m.expires_at > family.now) &&
      (m.kind === "story" ||
        m.kind === "voice" ||
        state.memoryContext.some((c) => c.source_id === m.id && c.legacy)),
  );
  const canAdd =
    family.member.role === "primary" || Boolean(family.member.can_contribute);
  return (
    <>
      <MemorySections current="stories" />
      <div className="story-heading">
        <div>
          <span className="section-kicker">In our own words</span>
          <h2>Stories we carry with us.</h2>
          <p>Familiar voices. Little details. A lifetime together.</p>
        </div>
        {canAdd && (
          <div className="button-row">
            <button className="button primary" onClick={() => onAdd("voice")}>
              <Mic size={18} />
              Record a story
            </button>
            <button className="button secondary" onClick={() => onAdd("story")}>
              <Plus size={18} />
              Write a story
            </button>
          </div>
        )}
      </div>
      <div className="legacy-stories">
        {stories.map((memory) => {
          const details = state.memoryContext.find(
            (c) => c.source_id === memory.id,
          );
          return (
            <article className="legacy-story" key={memory.id}>
              {memory.kind === "photo" && memory.media_id ? (
                <Image
                  unoptimized
                  src={`/api/media/${memory.media_id}`}
                  width={640}
                  height={400}
                  alt={memory.title}
                />
              ) : (
                <div
                  className={`legacy-symbol ${memory.kind}`}
                  aria-hidden="true"
                >
                  {memory.kind === "voice" ? (
                    <Mic size={36} />
                  ) : (
                    <BookHeart size={36} />
                  )}
                </div>
              )}
              <div>
                <span className="section-kicker">
                  {memory.author_name ||
                    family.members.find((m) => m.id === memory.author_id)?.name}
                  {details?.place ? ` · ${details.place}` : ""}
                </span>
                <h3>{memory.title}</h3>
                <p>{memory.caption}</p>
                {memory.kind === "voice" && memory.media_id && (
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/media/${memory.media_id}`}
                    aria-label={memory.title}
                  />
                )}
                <button
                  className="text-link"
                  onClick={() => onMemory(memory.id)}
                >
                  Open the story <ArrowRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!stories.length && (
        <Empty
          icon={<Mic size={36} />}
          title="Some stories deserve a familiar voice"
        >
          {canAdd && (
            <button className="button primary" onClick={() => onAdd("voice")}>
              Record your first family story
            </button>
          )}
        </Empty>
      )}
    </>
  );
}

export function FamilyActivities({
  onMemory,
  onAdd,
}: {
  onMemory: (id: string) => void;
  onAdd: AddStory;
}) {
  const { state, family, busy, run } = useCompanion();
  const [prompt, setPrompt] = useState<Activity["prompt_key"] | null>(null);
  if (!state) return <CompanionLoading />;
  const canAdd =
    family.member.role === "primary" || Boolean(family.member.can_contribute);
  const availableMembers = family.members.filter(
    (m) => m.active && (!m.expires_at || m.expires_at > family.now),
  );
  const activeActivities = state.activities.filter((a) =>
    ["invited", "accepted"].includes(a.status),
  );
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt) return;
    const form = new FormData(event.currentTarget);
    if (
      await run({
        action: "activity-create",
        promptKey: prompt,
        personId: String(form.get("person")),
        assigneeId: String(form.get("assignee")),
      })
    )
      setPrompt(null);
  }
  return (
    <>
      <MemorySections current="activities" />
      <div className="story-heading">
        <div>
          <span className="section-kicker">A little time together</span>
          <h2>Make a memory, together.</h2>
          <p>A question, a story, a moment to keep.</p>
        </div>
        <span className="activity-milestone">
          <Heart size={23} />
          {state.milestones.memoriesMadeTogether} memories made together
        </span>
      </div>
      {activeActivities.length > 0 && (
        <section className="activity-invitations">
          <h3>Your time together</h3>
          {activeActivities.map((activity) => {
            const assignedToMe = activity.assignee_id === family.member.id;
            const evidence = family.memories.filter(
              (m) =>
                m.author_id === family.member.id &&
                m.status === "approved" &&
                (!m.expires_at || m.expires_at > family.now) &&
                JSON.parse(m.person_ids).includes(activity.person_id),
            );
            const subject = family.people.find(
              (p) => p.id === activity.person_id,
            )?.name;
            return (
              <article className="activity-invitation" key={activity.id}>
                <div>
                  <span className="section-kicker">
                    {activity.status === "invited"
                      ? "An invitation"
                      : "A moment in the making"}{" "}
                    ·{" "}
                    {assignedToMe
                      ? "For you"
                      : `For ${family.members.find((m) => m.id === activity.assignee_id)?.name}`}
                  </span>
                  <h3>{activity.title}</h3>
                  <p>{activity.prompt}</p>
                  <span className="small muted">With {subject}</span>
                </div>
                <div className="activity-actions">
                  {assignedToMe && activity.status === "invited" && (
                    <div className="button-row">
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "activity-update",
                            id: activity.id,
                            operation: "accept",
                          })
                        }
                      >
                        <Check size={17} />
                        I&apos;d love to
                      </button>
                      <button
                        className="button quiet"
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "activity-update",
                            id: activity.id,
                            operation: "decline",
                          })
                        }
                      >
                        Not this time
                      </button>
                    </div>
                  )}
                  {assignedToMe && activity.status === "accepted" && (
                    <>
                      <button
                        className="button secondary"
                        disabled={!canAdd}
                        onClick={() => onAdd("voice", activity.person_id)}
                      >
                        <Mic size={17} />
                        Keep our story
                      </button>
                      {evidence.length > 0 ? (
                        <form
                          className="form-stack"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            await run({
                              action: "activity-update",
                              id: activity.id,
                              operation: "complete",
                              evidenceId: String(form.get("memory")),
                            });
                          }}
                        >
                          <label>
                            Our approved memory
                            <select name="memory" required>
                              <option value="">Choose a memory</option>
                              {evidence.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="button primary" disabled={busy}>
                            <Check size={16} />
                            We made a memory
                          </button>
                        </form>
                      ) : (
                        <p className="small muted">
                          Waiting for an approved memory with {subject}.
                        </p>
                      )}
                    </>
                  )}
                  {activity.creator_id === family.member.id && (
                    <button
                      className="button quiet"
                      disabled={busy}
                      onClick={() =>
                        run({
                          action: "activity-update",
                          id: activity.id,
                          operation: "cancel",
                        })
                      }
                    >
                      Cancel invitation
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      <div className="activity-catalog">
        {Object.entries(state.activityPrompts).map(([key, activity], index) => (
          <article
            className={`activity-card activity-color-${index % 3}`}
            key={key}
          >
            <span className="activity-number">0{index + 1}</span>
            <h3>{activity.title}</h3>
            <p>{activity.prompt}</p>
            <button
              className="button secondary"
              disabled={!canAdd || !family.people.length}
              onClick={() => setPrompt(key as Activity["prompt_key"])}
            >
              Make time for this <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {state.activities.some((a) => a.status === "completed") && (
        <section className="completed-memories">
          <h3>Moments you made</h3>
          {state.activities
            .filter((a) => a.status === "completed")
            .map((a) => (
              <div className="completed-memory" key={a.id}>
                <Heart size={18} />
                <strong>{a.title}</strong>
                {a.evidence_id ? (
                  <button
                    className="text-link"
                    onClick={() => onMemory(a.evidence_id!)}
                  >
                    Revisit <ArrowRight size={16} />
                  </button>
                ) : (
                  <span className="small muted">
                    Memory no longer available
                  </span>
                )}
              </div>
            ))}
        </section>
      )}
      {prompt && (
        <Modal
          title={state.activityPrompts[prompt].title}
          onClose={() => setPrompt(null)}
        >
          <form className="form-stack" onSubmit={invite}>
            <p>{state.activityPrompts[prompt].prompt}</p>
            <label>
              Who will make this memory?
              <select name="assignee" defaultValue={family.member.id}>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === family.member.id ? "Me" : m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Whose story will you share?
              <select name="person" required>
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
              <Heart size={17} />
              Save this invitation
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function MemoryWalks({ onMemory }: { onMemory: (id: string) => void }) {
  const { state, family, run, busy } = useCompanion();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  if (!state) return <CompanionLoading />;
  const approved = family.memories.filter(
    (m) =>
      m.status === "approved" && (!m.expires_at || m.expires_at > family.now),
  );
  const currentWalk = state.walks.find((w) => w.id === playing);
  if (currentWalk)
    return (
      <WalkPlayer
        walkId={currentWalk.id}
        onClose={() => setPlaying(null)}
        onMemory={onMemory}
      />
    );
  function reorder(index: number, direction: number) {
    const next = [...selected];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setSelected(next);
  }
  return (
    <>
      <MemorySections current="walks" />
      <div className="story-heading">
        <div>
          <span className="section-kicker">At your own pace</span>
          <h2>A walk through familiar moments.</h2>
        </div>
        <button
          className="button primary"
          disabled={!approved.length}
          onClick={() => {
            setSelected([]);
            setCreating(true);
          }}
        >
          <Plus size={18} />
          Create a memory walk
        </button>
      </div>
      <div className="walk-grid">
        {state.walks.map((walk) => {
          const cover = walk.items
            .map((i) => approved.find((m) => m.id === i.source_id))
            .find((m) => m?.kind === "photo" && m.media_id);
          return (
            <article className="walk-card" key={walk.id}>
              {cover ? (
                <Image
                  unoptimized
                  src={`/api/media/${cover.media_id}`}
                  width={600}
                  height={400}
                  alt={cover.title}
                />
              ) : (
                <div className="walk-art">
                  <Footprints size={44} />
                </div>
              )}
              <div>
                <span className="section-kicker">
                  {walk.items.length} moments · {walk.status}
                </span>
                <h3>{walk.title}</h3>
                <div className="button-row">
                  <button
                    className="button primary"
                    disabled={!walk.items.length || busy}
                    onClick={async () => {
                      if (walk.currentSourceId || walk.status === "completed") {
                        const result = await run({
                          action: "walk-progress",
                          id: walk.id,
                          position:
                            walk.status === "completed"
                              ? walk.items[0].ordinal
                              : walk.position,
                          status: "active",
                        });
                        if (!result) return;
                      }
                      setPlaying(walk.id);
                    }}
                  >
                    <Play size={17} />
                    {walk.status === "completed"
                      ? "Visit again"
                      : "Resume walk"}
                  </button>
                  <button
                    className="icon-button danger"
                    title="Delete walk"
                    aria-label={`Delete ${walk.title}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete this walk? Its original memories will stay in your vault.",
                        )
                      )
                        void run({ action: "walk-delete", id: walk.id });
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!state.walks.length && (
        <Empty
          icon={<Footprints size={36} />}
          title="A familiar place to return to"
        >
          <button
            className="button secondary"
            disabled={!approved.length}
            onClick={() => setCreating(true)}
          >
            Choose your moments
          </button>
        </Empty>
      )}
      {creating && (
        <Modal
          title="Create a memory walk"
          onClose={() => setCreating(false)}
          wide
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const result = await run({
                action: "walk-create",
                title: String(form.get("title")),
                sourceIds: selected,
              });
              if (result?.id) {
                setCreating(false);
                setPlaying(result.id);
              }
            }}
          >
            <label>
              Name your walk
              <input
                name="title"
                required
                maxLength={200}
                placeholder="Our favourite Sundays"
              />
            </label>
            <fieldset>
              <legend>Moments to revisit</legend>
              <div className="walk-picker">
                {approved.map((m) => (
                  <label className="check-label" key={m.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      disabled={
                        !selected.includes(m.id) && selected.length >= 30
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, m.id]
                            : selected.filter((id) => id !== m.id),
                        )
                      }
                    />
                    {m.kind === "photo" && m.media_id && (
                      <Image
                        unoptimized
                        src={`/api/media/${m.media_id}`}
                        width={70}
                        height={52}
                        alt=""
                      />
                    )}
                    <span>{m.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {selected.length > 1 && (
              <ol className="walk-order">
                {selected.map((id, i) => (
                  <li key={id}>
                    <span>{approved.find((m) => m.id === id)?.title}</span>
                    <button
                      type="button"
                      className="icon-button"
                      title="Move earlier"
                      aria-label={`Move moment ${i + 1} earlier`}
                      disabled={i === 0}
                      onClick={() => reorder(i, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Move later"
                      aria-label={`Move moment ${i + 1} later`}
                      disabled={i === selected.length - 1}
                      onClick={() => reorder(i, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <CompanionFeedback />
            <button
              className="button primary"
              disabled={busy || !selected.length}
            >
              <Footprints size={18} />
              Save memory walk
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function WalkPlayer({
  walkId,
  onClose,
  onMemory,
}: {
  walkId: string;
  onClose: () => void;
  onMemory: (id: string) => void;
}) {
  const { state, family, run, busy } = useCompanion();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const walk = state?.walks.find((w) => w.id === walkId);
  if (!walk)
    return (
      <Empty
        icon={<Footprints size={30} />}
        title="This walk is no longer available"
      >
        <button className="button secondary" onClick={onClose}>
          Back to walks
        </button>
      </Empty>
    );
  const memory = walk.currentSourceId
    ? family.memories.find(
        (m) =>
          m.id === walk.currentSourceId &&
          m.status === "approved" &&
          (!m.expires_at || m.expires_at > family.now),
      )
    : undefined;
  const previous = [...walk.items]
    .reverse()
    .find((i) => i.ordinal < walk.position);
  const next = walk.items.find((i) => i.ordinal > walk.position);
  const photoDetails = state?.photos.analyses.find(a => a.sourceId === memory?.id && a.status === "approved")?.content;
  const go = (position: number) =>
    run({ action: "walk-progress", id: walk.id, position, status: "active" });
  return (
    <section
      className="walk-player"
      tabIndex={0}
      aria-label={walk.title}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || busy) return;
        if (e.key === "ArrowRight" && next) {
          e.preventDefault();
          void go(next.ordinal);
        }
        if (e.key === "ArrowLeft" && previous) {
          e.preventDefault();
          void go(previous.ordinal);
        }
      }}
      onTouchStart={(e) => {
        if (!(e.target as HTMLElement).closest("button,audio"))
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start || busy) return;
        const x = e.changedTouches[0].clientX - start.x;
        const y = e.changedTouches[0].clientY - start.y;
        if (Math.abs(x) > 70 && Math.abs(x) > Math.abs(y) * 1.5) {
          if (x < 0 && next) void go(next.ordinal);
          if (x > 0 && previous) void go(previous.ordinal);
        }
      }}
    >
      <div className="section-heading">
        <button
          className="button quiet"
          onClick={async () => {
            if (
              memory &&
              !(await run({
                action: "walk-progress",
                id: walk.id,
                position: walk.position,
                status: "paused",
              }))
            )
              return;
            onClose();
          }}
        >
          <ArrowLeft size={17} />
          Your walks
        </button>
        <span className="section-kicker">
          <Footprints size={16} />
          {walk.title}
        </span>
        <button
          className="button secondary"
          disabled={busy || !memory}
          onClick={() =>
            run({
              action: "walk-progress",
              id: walk.id,
              position: walk.position,
              status: walk.status === "active" ? "paused" : "active",
            })
          }
        >
          {walk.status === "active" ? <Pause size={17} /> : <Play size={17} />}
          {walk.status === "active" ? "Pause" : "Resume"}
        </button>
      </div>
      {memory ? (
        <div className="walk-scene" key={memory.id}>
          {memory.kind === "photo" && memory.media_id ? (
            <Image
              unoptimized
              src={`/api/media/${memory.media_id}`}
              alt={memory.title}
              width={1200}
              height={750}
            />
          ) : (
            <div className="walk-voice-art">
              {memory.kind === "voice" ? (
                <Mic size={56} />
              ) : (
                <BookHeart size={56} />
              )}
            </div>
          )}
          <div className="walk-narration">
            <span className="section-kicker">A moment from your family</span>
            <h2>{memory.title}</h2>
            <p>{memory.caption || photoDetails?.description}</p>
            {photoDetails && <blockquote className="walk-photo-prompt">{photoDetails.storyPrompt}</blockquote>}
            {memory.kind === "voice" && memory.media_id && (
              <audio
                key={memory.media_id}
                controls
                src={`/api/media/${memory.media_id}`}
                aria-label={memory.title}
              />
            )}
            <LocalReadAloud text={memory.caption || photoDetails?.description || ""} />
            <button className="text-link" onClick={() => onMemory(memory.id)}>
              Original memory <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <Empty
          icon={<BookHeart size={36} />}
          title="This moment is no longer available"
        >
          <p>Choose another moment to continue.</p>
        </Empty>
      )}
      <div className="walk-controls">
        <button
          className="button secondary"
          disabled={busy || !previous}
          onClick={() => previous && go(previous.ordinal)}
        >
          <ArrowLeft size={18} />
          Previous
        </button>
        <span className="small muted" aria-live="polite">
          {memory
            ? `${walk.items.findIndex((i) => i.source_id === memory.id) + 1} of ${walk.items.length}`
            : `${walk.items.length} available moments`}
        </span>
        {next ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => go(next.ordinal)}
          >
            Next moment <ArrowRight size={18} />
          </button>
        ) : (
          <button
            className="button primary"
            disabled={busy || !memory}
            onClick={async () => {
              if (
                await run({
                  action: "walk-progress",
                  id: walk.id,
                  position: walk.position,
                  status: "completed",
                })
              )
                onClose();
            }}
          >
            <Check size={18} />
            Finish this walk
          </button>
        )}
      </div>
    </section>
  );
}
