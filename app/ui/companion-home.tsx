"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookHeart,
  CalendarDays,
  Check,
  Heart,
  Mic,
  Music,
  Sun,
} from "lucide-react";
import { displayDate, useCompanion } from "./companion-context";
import { Empty } from "./primitives";

export function DailyMoments({
  personId,
  onMemory,
  onReply,
  onAdd,
}: {
  personId: string | null;
  onMemory: (id: string) => void;
  onReply: (id: string) => void;
  onAdd: () => void;
}) {
  const { state, family } = useCompanion();
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const available = family.memories.filter(
    (m) =>
      m.status === "approved" &&
      (!m.expires_at || m.expires_at > family.now) &&
      (!personId || JSON.parse(m.person_ids).includes(personId)),
  );
  const daily = state?.dailyMoment;
  const memories = [
    ...available.filter((m) => m.id === daily?.memory.id),
    ...available.filter((m) => m.id !== daily?.memory.id),
  ].slice(0, 8);
  const position = Math.min(index, Math.max(0, memories.length - 1));
  function move(next: number) {
    const slides = rail.current?.querySelectorAll<HTMLElement>(".daily-slide");
    if (!slides?.[next]) return;
    rail.current?.scrollTo({
      left: slides[next].offsetLeft,
      behavior: "smooth",
    });
  }
  if (!memories.length)
    return (
      <Empty icon={<BookHeart size={32} />} title="A little moment starts here">
        <button className="button primary" onClick={onAdd}>
          Add a family memory
        </button>
      </Empty>
    );
  return (
    <section className="daily-moments" aria-label="Your memory moment">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Sun size={16} />A little closer today
          </span>
          <h2>
            {personId
              ? `With ${family.people.find((p) => p.id === personId)?.name ?? "your family"}`
              : "Your memory moment"}
          </h2>
        </div>
        <div className="button-row">
          <span className="small muted" aria-live="polite">
            {position + 1} / {memories.length}
          </span>
          <button
            className="icon-button"
            title="Previous moment"
            aria-label="Previous moment"
            disabled={position === 0}
            onClick={() => move(position - 1)}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            className="icon-button"
            title="Next moment"
            aria-label="Next moment"
            disabled={position === memories.length - 1}
            onClick={() => move(position + 1)}
          >
            <ArrowRight size={19} />
          </button>
        </div>
      </div>
      <div
        className="daily-rail"
        ref={rail}
        tabIndex={0}
        aria-label="Family memory slides"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            move(position + (e.key === "ArrowRight" ? 1 : -1));
          }
        }}
        onScroll={() => {
          const node = rail.current;
          if (node)
            setIndex(Math.round(node.scrollLeft / (node.clientWidth + 20)));
        }}
      >
        {memories.map((memory) => (
          <article
            className={`daily-slide daily-kind-${memory.kind}`}
            key={memory.id}
          >
            {memory.kind === "photo" && memory.media_id ? (
              <button
                className="daily-photo"
                onClick={() => onMemory(memory.id)}
                aria-label={`Open ${memory.title}`}
              >
                <Image
                  unoptimized
                  src={`/api/media/${memory.media_id}`}
                  width={1100}
                  height={620}
                  alt={memory.title}
                  priority={memory.id === memories[0].id}
                />
              </button>
            ) : (
              <div className="daily-story-art">
                <span>
                  {memory.kind === "voice" ? (
                    <Music size={36} />
                  ) : (
                    <BookHeart size={36} />
                  )}
                </span>
                <p>{memory.caption}</p>
              </div>
            )}
            <div className="daily-caption">
              <div>
                <span className="section-kicker">
                  {daily?.kind === "anniversary" &&
                  daily.memory.id === memory.id
                    ? `${daily.yearsAgo} years ago, on this day`
                    : `From ${memory.author_name || family.members.find((m) => m.id === memory.author_id)?.name || "your family"}`}
                </span>
                <h3>{memory.title}</h3>
                <p>{memory.caption}</p>
              </div>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => onMemory(memory.id)}
                >
                  Revisit this moment <ArrowRight size={16} />
                </button>
                {memory.author_id !== family.member.id && (
                  <button
                    className="button quiet"
                    onClick={() => onReply(memory.author_id)}
                  >
                    <Mic size={17} />
                    Send a little love
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ConnectionInvitation({
  onReply,
  onMemory,
}: {
  onReply: (id: string) => void;
  onMemory: (id: string) => void;
}) {
  const { state, family, busy, run } = useCompanion();
  const [checkedIn, setCheckedIn] = useState(false);
  if (!state) return null;
  const reminder = state.connections.find((c) => c.reminder);
  const anniversary = state.anniversaryNotices.find((notice) => !notice.readAt);
  return (
    <>
      {anniversary && (
        <div className="memory-anniversary-invitation">
          <span className="anniversary-icon" aria-hidden="true">
            <CalendarDays size={23} />
          </span>
          <div>
            <span className="section-kicker">A year to remember</span>
            <h3>{anniversary.title}</h3>
            <p>{anniversary.text}</p>
          </div>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => onMemory(anniversary.sourceId)}
            >
              Revisit memory <ArrowRight size={16} />
            </button>
            {anniversary.authorId !== family.member.id && (
              <button
                className="button secondary"
                onClick={() => onReply(anniversary.authorId)}
              >
                <Mic size={17} /> Plan together
              </button>
            )}
            <button
              className="button quiet"
              disabled={busy}
              onClick={() => run({ action: "anniversary-read", id: anniversary.id })}
            >
              Mark seen
            </button>
          </div>
        </div>
      )}
      {state.preferences.checkin_enabled === 1 && (
        <div className="gentle-checkin">
          <Heart size={20} />
          <span>Your family check-in</span>
          <button
            disabled={busy}
            className="button secondary"
            onClick={async () => {
              if (await run({ action: "check-in" })) setCheckedIn(true);
            }}
          >
            <Check size={17} />
            I&apos;m here today
          </button>
          <span className="small muted" role="status">
            {checkedIn ? "Your check-in is saved. " : ""}
            Last check-in{" "}
            {displayDate(
              state.preferences.checked_in_at,
              family.family.timezone,
            )}
          </span>
        </div>
      )}
      {state.notices.map((notice) => (
        <div className="connection-invitation" key={notice.id}>
          <div>
            <span className="section-kicker">A family check-in</span>
            <p>{notice.text}</p>
          </div>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => onReply(notice.subjectId)}
            >
              <Mic size={17} />
              Reach out
            </button>
            {!notice.readAt && (
              <button
                className="button quiet"
                disabled={busy}
                onClick={() => run({ action: "notice-read", id: notice.id })}
              >
                Mark seen
              </button>
            )}
          </div>
        </div>
      ))}
      {reminder && (
        <div className="connection-invitation">
          <div>
            <span className="section-kicker">A small hello</span>
            <p>{reminder.reminder}</p>
          </div>
          <button
            className="button secondary"
            onClick={() => onReply(reminder.memberId)}
          >
            Say hello <ArrowRight size={16} />
          </button>
        </div>
      )}
      {!reminder && (
        <Link className="make-memory-invitation" href="/activities">
          <Heart size={19} />
          <span>Make a new memory together</span>
          <ArrowRight size={18} />
        </Link>
      )}
    </>
  );
}
