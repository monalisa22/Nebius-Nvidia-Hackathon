"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookHeart,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LoaderCircle,
  Mic,
  RefreshCw,
  ScanText,
  Shuffle,
} from "lucide-react";
import type { Moment } from "@/lib/anubandh/moments";
import type { Memory, Snapshot } from "@/lib/anubandh/types";
import { LocalReadAloud, Modal } from "./primitives";

export function Moments({
  moments,
  onOpen,
  onRediscover,
}: {
  moments: Moment[];
  onOpen: (id: string) => void;
  onRediscover?: (id: string) => void;
}) {
  const shelf = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState({ left: false, right: false });
  useEffect(() => {
    const element = shelf.current;
    if (!element) return;
    const update = () =>
      setScrollable({
        left: element.scrollLeft > 4,
        right:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    const frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [moments.length]);
  function browse(direction: number) {
    const element = shelf.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  if (!moments.length) return null;
  return (
    <section className="moments-section" aria-labelledby="moments-title">
      <div className="section-heading">
        <h2 id="moments-title">Little things, kept close.</h2>
        <div className="shelf-tools">
          {onRediscover && (
            <button
              className="button quiet rediscover-button"
              onClick={() => {
                const memories = Array.from(
                  new Map(
                    moments
                      .flatMap((moment) => moment.memories)
                      .map((memory) => [memory.id, memory]),
                  ).values(),
                );
                const memory =
                  memories[Math.floor(Math.random() * memories.length)];
                if (memory) onRediscover(memory.id);
              }}
            >
              <Shuffle size={18} />
              Surprise me
            </button>
          )}
          <div className="shelf-navigation">
            <button
              className="icon-button"
              title="Previous collections"
              aria-label="Previous collections"
              disabled={!scrollable.left}
              onClick={() => browse(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-button"
              title="Next collections"
              aria-label="Next collections"
              disabled={!scrollable.right}
              onClick={() => browse(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
      <div className="moments-strip" ref={shelf}>
        {moments.map((moment) => (
          <MomentCover
            key={`${moment.id}:${moment.memories[0].id}:${moment.memories[0].revision}`}
            moment={moment}
            onOpen={() => onOpen(moment.id)}
          />
        ))}
      </div>
    </section>
  );
}

function MomentCover({
  moment,
  onOpen,
}: {
  moment: Moment;
  onOpen: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const photo = moment.memories.find(
    (memory) => memory.kind === "photo" && memory.media_id,
  );
  const source = photo ?? moment.memories[0];
  const Icon =
    moment.id === "voices"
      ? Mic
      : moment.id === "photos"
        ? ImageIcon
        : BookHeart;
  return (
    <article className={`moment-shell ${moment.tone}`} data-preview={preview}>
      <button
        className={`moment-cover ${moment.tone}`}
        onClick={onOpen}
        aria-label={`Open ${moment.title}`}
      >
        <span className="moment-visual">
          {photo && !imageFailed && !preview ? (
            <Image
              unoptimized
              width={640}
              height={520}
              src={`/api/media/${photo.media_id}`}
              alt=""
              loading="eager"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="moment-art" key={String(preview)}>
              <Icon size={27} />
              <span className="moment-art-excerpt">{source.caption}</span>
              <span className="moment-byline">
                From {source.author_name ?? "your family"}
              </span>
            </span>
          )}
          {!preview && photo && !imageFailed && (
            <span className="album-stamp">
              <Icon size={15} />{" "}
              {moment.id === "photos" ? "In pictures" : "Our little world"}
            </span>
          )}
        </span>
        <span className="moment-cover-caption">
          <strong>{moment.title}</strong>
          <span>
            {moment.memories.length}{" "}
            {moment.memories.length === 1 ? "memory" : "memories"}
            <ArrowRight className="album-arrow" size={20} />
          </span>
        </span>
      </button>
      {photo && (
        <button
          className="icon-button moment-peek"
          title={
            preview
              ? `Show cover of ${moment.title}`
              : `Peek inside ${moment.title}`
          }
          aria-label={
            preview
              ? `Show cover of ${moment.title}`
              : `Peek inside ${moment.title}`
          }
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? <ImageIcon size={19} /> : <BookOpen size={19} />}
        </button>
      )}
    </article>
  );
}

export function MemoryJourney({
  moment,
  data,
  onClose,
  onInspect,
  onReply,
}: {
  moment?: Moment;
  data: Snapshot;
  onClose: () => void;
  onInspect: (id: string) => void;
  onReply: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(moment?.memories[0]?.id);
  const memory = moment?.memories.find((m) => m.id === selectedId);
  const index = memory ? moment!.memories.indexOf(memory) : -1;
  function move(step: number) {
    const next = moment?.memories[index + step];
    if (next) setSelectedId(next.id);
  }
  // Do not silently replace a currently viewed source after deletion or access changes.
  if (!memory || !moment)
    return (
      <Modal title="Memory no longer available" onClose={onClose}>
        <p>This memory was removed or its access changed.</p>
        <button className="button primary" onClick={onClose}>
          Back to your day
        </button>
      </Modal>
    );
  const recipient = data.members.find(
    (m) =>
      m.id === memory.author_id &&
      m.id !== data.member.id &&
      m.active &&
      (!m.expires_at || m.expires_at > data.now),
  );
  return (
    <Modal title={moment.title} onClose={onClose} wide>
      <div
        className="memory-journey"
        role="group"
        aria-label="Memory viewer"
        onKeyDown={(event) => {
          if (
            (event.target as HTMLElement).closest(
              "audio, input, textarea, select",
            )
          )
            return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <div className="journey-navigation">
          <button
            className="icon-button"
            title="Previous memory"
            aria-label="Previous memory"
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ArrowLeft size={22} />
          </button>
          <span aria-live="polite" aria-atomic="true">
            {index + 1} of {moment.memories.length}
          </span>
          <button
            className="icon-button"
            title="Next memory"
            aria-label="Next memory"
            disabled={index === moment.memories.length - 1}
            onClick={() => move(1)}
          >
            <ArrowRight size={22} />
          </button>
        </div>
        <JourneyItem
          key={`${memory.id}:${memory.revision}`}
          memory={memory}
          timezone={data.family.timezone}
        />
        <div className="journey-actions">
          <button
            className="button secondary"
            onClick={() => onInspect(memory.id)}
          >
            <ScanText size={18} />
            View original
          </button>
          {recipient && (
            <button
              className="button primary"
              onClick={() => onReply(recipient.id)}
            >
              <Mic size={18} />
              <span>Reply to {recipient.name}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function JourneyItem({
  memory,
  timezone,
}: {
  memory: Memory;
  timezone: string;
}) {
  const [photoState, setPhotoState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [photoAttempt, setPhotoAttempt] = useState(0);
  return (
    <div className="journey-item">
      {memory.kind === "photo" && memory.media_id && (
        <div className="journey-photo" data-loading={photoState !== "ready"}>
          <Image
            key={photoAttempt}
            unoptimized
            width={1200}
            height={800}
            loading="eager"
            src={`/api/media/${memory.media_id}`}
            alt={memory.title}
            onLoad={() => setPhotoState("ready")}
            onError={() => setPhotoState("error")}
          />
          {photoState !== "ready" && (
            <div className="journey-placeholder" role="status">
              {photoState === "loading" ? (
                <>
                  <LoaderCircle size={24} className="spin" />
                  Opening photograph
                </>
              ) : (
                <>
                  <span>This photograph could not be loaded.</span>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setPhotoState("loading");
                      setPhotoAttempt((value) => value + 1);
                    }}
                  >
                    <RefreshCw size={18} />
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="journey-copy">
        <span className="journey-source">
          From {memory.author_name ?? "Family"} · Added{" "}
          {new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: timezone,
          }).format(memory.created_at)}
        </span>
        <h3>{memory.title}</h3>
        <p className="memory-caption">{memory.caption}</p>
        {memory.kind === "voice" && memory.media_id ? (
          <audio
            controls
            preload="metadata"
            src={`/api/media/${memory.media_id}`}
            aria-label={memory.title}
          />
        ) : (
          <LocalReadAloud text={memory.caption} />
        )}
      </div>
    </div>
  );
}
