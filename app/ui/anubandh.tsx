"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Bell,
  BookHeart,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Heart,
  HeartHandshake,
  Home,
  ImagePlus,
  Inbox,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import type {
  Artifact,
  BriefContent,
  Call,
  Member,
  Memory,
  Person,
  Snapshot,
} from "@/lib/anubandh/types";
import { Avatar, Empty, LocalReadAloud, Modal } from "./primitives";
import { buildMoments } from "@/lib/anubandh/moments";
import { MemoryJourney, Moments } from "./moments";
import { FamilyCircle } from "./family-circle";
import { TogetherlyBrand } from "./togetherly-brand";
import type { CompanionSnapshot } from "@/lib/togetherly/service";
import {
  CompanionContext,
  CompanionFeedback,
  MemorySections,
  useCompanionController,
} from "./companion-context";
import { DailyMoments, ConnectionInvitation } from "./companion-home";
import {
  PeopleSections,
  PersonCompanion,
  FamilyTree,
  WhatMatters,
} from "./companion-people";
import {
  FamilyStories,
  FamilyActivities,
  MemoryWalks,
} from "./companion-memories";
import { MemoryCapsules } from "./companion-capsules";
import { CompanionChoices } from "./companion-choices";
import { ConversationCompanion } from "./companion-conversation";
import { ConnectionRituals, RitualInvitation } from "./connection-rituals";
import { PhotoCollections } from "./photo-memories";
import {
  CallForm,
  ContributeForm,
  InviteForm,
  MemoryDetail,
  PersonForm,
  ReplyForm,
  type Action,
} from "./forms";

type Dialog =
  | {
      type:
        | "contribute"
        | "reply"
        | "schedule"
        | "invite"
        | "person"
        | "consent"
        | "search"
        | "notifications";
      id?: string;
      kind?: Memory["kind"];
      personId?: string;
    }
  | { type: "memory"; id: string }
  | { type: "journey"; id: string }
  | null;
const titles: Record<string, string> = {
  today: "Your day",
  family: "Your people",
  memories: "Memories",
  calls: "Family calls",
  messages: "Messages",
  choices: "My choices",
  contribute: "Contributions",
  review: "Review memories",
  stories: "Family stories",
  activities: "Make a memory",
  walks: "Memory walks",
  capsules: "For later",
  "family-tree": "Family connections",
  insights: "What matters",
  conversation: "Conversation companion",
  rituals: "Connection rituals",
};
function personFor(data: Snapshot, memberId: string) {
  const member = data.members.find((m) => m.id === memberId);
  return data.people.find((p) => p.id === member?.person_id);
}
function dateLabel(timestamp: number, timezone: string, withTime = false) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    ...(withTime
      ? { hour: "numeric" as const, minute: "2-digit" as const }
      : {}),
  }).format(timestamp);
}
export function Anubandh({
  initial,
  initialCompanion,
  initialPersonId,
  view,
}: {
  initial: Snapshot;
  initialCompanion: CompanionSnapshot;
  initialPersonId?: string;
  view: string;
}) {
  const [data, setData] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [largeText, setLargeText] = useState(false);
  const [homePersonId, setHomePersonId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const primary = data.member.role === "primary";
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/family", { cache: "no-store" });
      if (response.status === 401) {
        router.refresh();
        return;
      }
      if (response.ok) setData(await response.json());
    } catch {
      /* Last confirmed state remains visible when offline. */
    }
  }, [router]);
  const companion = useCompanionController(initialCompanion, data, refresh);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const stored = localStorage.getItem("anubandh-large-text");
    if (stored === "yes") document.documentElement.dataset.largeText = "true";
    const frame = requestAnimationFrame(() => setLargeText(stored === "yes"));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const overflow = document.body.style.overflow;
    if (mobileMenu) document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      if (mobileMenu)
        sidebar
          ?.querySelector<HTMLButtonElement>(".sidebar-close")
          ?.focus({ preventScroll: true });
    });
    function keyboard(event: KeyboardEvent) {
      if (!mobileMenu) return;
      if (event.key === "Escape") {
        setMobileMenu(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
      if (event.key === "Tab" && sidebar) {
        const controls = Array.from(
          sidebar.querySelectorAll<HTMLElement>(
            "a[href], button:not(:disabled), summary",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = overflow;
    };
  }, [mobileMenu]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const act: Action = async (action, payload = {}) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      await companion
        .refresh()
        .catch(() => setToast("Saved. Reconnecting to your family space."));
      return result;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Connection lost. Please try again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  function open(next: Dialog) {
    setError("");
    setDialog(next);
  }
  function close() {
    setDialog(null);
    setError("");
  }
  async function generate(
    kind: "briefing" | "call",
    callId: string | null = null,
  ) {
    if (!data.family.cloud_consent) {
      open({ type: "consent", id: callId ?? undefined });
      return;
    }
    if (await act("generate", { kind, callId }))
      setToast("Your brief is queued. You can continue using Togetherly.");
  }
  const approved = data.memories.filter(
    (m) =>
      m.status === "approved" && (!m.expires_at || m.expires_at > data.now),
  );
  const moments = buildMoments(data.memories, data.now);
  const selectedPerson = data.people.find(
    (person) => person.id === homePersonId,
  );
  const homeMemories = selectedPerson
    ? approved.filter((memory) =>
        JSON.parse(memory.person_ids).includes(selectedPerson.id),
      )
    : approved;
  const homeMoments = buildMoments(homeMemories, data.now);
  const pending = data.memories.filter((m) => m.status === "pending");
  const upcoming = data.calls.filter((c) => c.scheduled_at > data.now);
  const unread = data.messages.filter(
    (m) => m.recipient_id === data.member.id && m.status === "delivered",
  ).length;
  const anniversaryNotices = companion.state?.anniversaryNotices ?? [];
  const unreadAnniversaries = anniversaryNotices.filter((notice) => !notice.readAt).length;
  const notificationCount = unread + unreadAnniversaries;
  const nextCall = upcoming[0];
  const activeJobs = data.jobs.filter((j) =>
    ["queued", "running"].includes(j.status),
  );
  const briefing = data.artifacts.find((a) => a.kind === "briefing");
  const visibleMemories = data.memories.filter(
    (memory) =>
      (view === "review"
        ? memory.status === "pending"
        : view === "contribute"
          ? memory.author_id === data.member.id
          : memory.status === "approved") &&
      (filter === "all" || view !== "memories" || memory.kind === filter) &&
      [
        memory.title,
        memory.caption,
        ...((companion.state?.photos.analyses ?? []).filter(a => a.sourceId === memory.id && a.status === "approved").flatMap(a => a.content ? [a.content.description, ...a.content.observations] : [])),
        ...data.people
          .filter((person) => JSON.parse(memory.person_ids).includes(person.id))
          .map((person) => person.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const searchResults = approved.filter((memory) =>
    `${memory.title} ${memory.caption}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const props = { data, act, onClose: close, busy, error };
  const onMemory = (id: string) => open({ type: "memory", id });
  const onReply = (id: string) => open({ type: "reply", id });
  const onAdd = (kind?: Memory["kind"], personId?: string) =>
    open({ type: "contribute", kind, personId });
  const activeView = ["stories", "activities", "walks"].includes(view)
    ? "memories"
    : ["family-tree", "insights"].includes(view)
      ? "family"
      : view === "capsules"
        ? "messages"
        : view === "conversation"
          ? "calls"
          : view;
  const visibleMessages = data.messages.filter(
    (m) =>
      !companion.state?.capsules.some(
        (c) => c.message_id === m.id && c.status !== "delivered",
      ) &&
      (filter === "all" ||
        !["inbox", "drafts", "sent"].includes(filter) ||
        (filter === "inbox" && m.recipient_id === data.member.id) ||
        (filter === "drafts" && m.status === "draft") ||
        (filter === "sent" &&
          m.sender_id === data.member.id &&
          m.status !== "draft")),
  );
  const headingActionLabel =
    view === "calls"
      ? "Plan a call"
      : view === "family"
        ? "Add a person"
        : view === "messages"
          ? "New reply"
          : "Add a memory";
  const navigation = [
    { key: "today", href: "/", label: "Your day", Icon: Home },
    {
      key: "memories",
      href: "/memories",
      label: "Memories",
      Icon: BookHeart,
    },
    { key: "family", href: "/family", label: "Your people", Icon: Users },
    {
      key: "messages",
      href: "/messages",
      label: "Messages",
      Icon: MessageCircle,
    },
  ];
  const currentMemory =
    dialog?.type === "memory"
      ? data.memories.find((m) => m.id === dialog.id)
      : undefined;

  return (
    <CompanionContext.Provider value={companion}>
      <div
        className={`app-shell personal-shell ${view === "today" ? "personal-home" : ""}`}
      >
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {mobileMenu && (
          <button
            className="sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => {
              setMobileMenu(false);
              requestAnimationFrame(() => menuButtonRef.current?.focus());
            }}
          />
        )}
        <aside
          ref={sidebarRef}
          inert={!mobileMenu}
          id="family-navigation"
          className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a[href]"))
              setMobileMenu(false);
          }}
        >
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            title="Close navigation"
            onClick={() => {
              setMobileMenu(false);
              requestAnimationFrame(() => menuButtonRef.current?.focus());
            }}
          >
            <X size={20} />
          </button>
          <Link className="brand" href="/">
            <TogetherlyBrand />
          </Link>
          <div className="family-label">
            <span className="family-label-icon">
              <Heart size={15} />
            </span>
            {data.family.name}
          </div>
          <nav aria-label="Primary navigation">
            {navigation.map(({ key, href, label, Icon }) => (
              <Link
                key={key}
                href={href}
                onClick={() => setMobileMenu(false)}
                className={`nav-item ${activeView === key ? "active" : ""}`}
                aria-current={activeView === key ? "page" : undefined}
              >
                <Icon size={21} />
                <span>{label}</span>
                {key === "messages" && unread > 0 && (
                  <span className="nav-count">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="nav-divider" />
          <nav aria-label="Family management">
            <Link
              className={`nav-item ${activeView === "calls" ? "active" : ""}`}
              href="/calls"
              aria-current={activeView === "calls" ? "page" : undefined}
            >
              <Video size={20} />
              <span>Family calls</span>
            </Link>
            <Link
              className={`nav-item ${view === "choices" ? "active" : ""}`}
              href="/choices"
              aria-current={view === "choices" ? "page" : undefined}
            >
              <Settings2 size={20} />
              <span>My choices</span>
            </Link>
            {(primary || data.member.can_contribute === 1) && (
              <details
                className="management-menu"
                open={view === "review" || view === "contribute"}
              >
                <summary>
                  <Inbox size={20} />
                  <span>Manage memories</span>
                  {primary && pending.length > 0 && (
                    <span className="nav-count amber">{pending.length}</span>
                  )}
                </summary>
                {primary && (
                  <Link
                    className={`nav-item ${view === "review" ? "active" : ""}`}
                    href="/review"
                  >
                    <Inbox size={20} />
                    <span>Review memories</span>
                    {pending.length > 0 && (
                      <span className="nav-count amber">{pending.length}</span>
                    )}
                  </Link>
                )}
                {(primary || data.member.can_contribute === 1) && (
                  <Link
                    className={`nav-item ${view === "contribute" ? "active" : ""}`}
                    href="/contribute"
                  >
                    <ImagePlus size={20} />
                    <span>Contributions</span>
                  </Link>
                )}
              </details>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="private-note">
              <LockKeyhole size={17} />
              <span>
                Your family space
                <small>
                  {data.family.is_demo
                    ? "Isolated sample family"
                    : "Access controlled by you"}
                </small>
              </span>
            </div>
            <div className="sidebar-profile">
              <Link
                href="/choices"
                className="profile-link"
                aria-label="My choices"
                title="My choices"
              >
                <Avatar
                  src={personFor(data, data.member.id)?.avatar}
                  name={data.member.name}
                />
              </Link>
              <span>
                <strong>{data.member.name}</strong>
                <small>
                  {primary ? "Your personal space" : data.member.relationship}
                </small>
              </span>
              <button
                className="icon-button topbar-search"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await fetch("/api/account", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  });
                  router.push("/");
                  router.refresh();
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>
        <div className="workspace" inert={mobileMenu}>
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                title="Open navigation"
                aria-expanded={mobileMenu}
                aria-controls="family-navigation"
                ref={menuButtonRef}
                onClick={() => setMobileMenu(true)}
              >
                <Menu />
              </button>
              <Link
                href="/"
                className="mobile-brand"
                aria-label="Togetherly home"
              >
                <TogetherlyBrand />
              </Link>
            </div>
            <nav className="desktop-tabs" aria-label="Everyday navigation">
              {navigation.map(({ key, href, label, Icon }) => (
                <Link
                  key={key}
                  href={href}
                  aria-current={activeView === key ? "page" : undefined}
                >
                  <Icon size={19} />
                  <span>{key === "family" ? "People" : label}</span>
                  {key === "messages" && unread > 0 && (
                    <span className="tab-unread">{unread}</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="topbar-actions">
              <button
                className="icon-button"
                title="Search memories"
                aria-label="Search memories"
                onClick={() => open({ type: "search" })}
              >
                <Search size={21} />
              </button>
              <button
                className="icon-button text-size"
                title="Toggle larger text"
                aria-label="Toggle larger text"
                aria-pressed={largeText}
                onClick={() => {
                  const next =
                    document.documentElement.dataset.largeText !== "true";
                  document.documentElement.dataset.largeText = String(next);
                  setLargeText(next);
                  localStorage.setItem(
                    "anubandh-large-text",
                    next ? "yes" : "no",
                  );
                }}
              >
                Aa
              </button>
              <button
                className="icon-button notification-button"
                title="Notifications"
                aria-label={`${notificationCount} new notifications`}
                onClick={() => open({ type: "notifications" })}
              >
                <Bell size={21} />
                {notificationCount > 0 && <i />}
              </button>
              <Avatar
                src={personFor(data, data.member.id)?.avatar}
                name={data.member.name}
              />
            </div>
          </header>
          <main id="main-content" className="page-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {new Intl.DateTimeFormat("en", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: data.family.timezone,
                  }).format(new Date(data.now))}
                </p>
                <h1>
                  {view === "today"
                    ? `Hello, ${data.member.name}.`
                    : titles[view]}
                </h1>
              </div>
              {[
                "today",
                "memories",
                "family",
                "calls",
                "messages",
                "review",
                "contribute",
              ].includes(view) && (
                <button
                  className="button primary"
                  aria-label={headingActionLabel}
                  title={headingActionLabel}
                  onClick={() =>
                    open({
                      type:
                        view === "calls"
                          ? "schedule"
                          : view === "family"
                            ? "person"
                            : view === "messages"
                              ? "reply"
                              : "contribute",
                    })
                  }
                  disabled={
                    view === "calls"
                      ? !primary && !data.member.can_schedule
                      : view === "family"
                        ? !primary
                        : view === "messages"
                          ? false
                          : !primary && !data.member.can_contribute
                  }
                >
                  <Plus size={19} />
                  <span className="heading-action-label">
                    {headingActionLabel}
                  </span>
                </button>
              )}
            </div>
            {error && !dialog && (
              <div className="error-banner" role="alert">
                {error}
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <CompanionFeedback />
            {activeJobs.length > 0 && (
              <div className="job-banner" role="status">
                <LoaderCircle className="spin" size={20} />
                <span>
                  {activeJobs[0].status === "running"
                    ? "Preparing your family brief"
                    : "Family brief queued"}
                  <small>
                    {data.worker.heartbeat &&
                    data.now - data.worker.heartbeat < 180000
                      ? "Your approved memories stay linked to their sources."
                      : "Waiting for the background worker to connect."}
                  </small>
                </span>
                <button
                  className="button quiet"
                  disabled={busy}
                  onClick={() =>
                    act("job", { id: activeJobs[0].id, operation: "cancel" })
                  }
                >
                  Cancel
                </button>
              </div>
            )}

            {view === "today" && (
              <>
                <FamilyCircle
                  people={data.people}
                  selectedId={selectedPerson?.id ?? null}
                  onSelect={setHomePersonId}
                />
                <DailyMoments
                  key={homePersonId ?? "everyone"}
                  personId={homePersonId}
                  onMemory={onMemory}
                  onReply={onReply}
                  onAdd={onAdd}
                />
                <ConnectionInvitation onReply={onReply} onMemory={onMemory} />
                <RitualInvitation />
                <div className="today-grid">
                  <section className="today-main">
                    <Moments
                      moments={homeMoments}
                      onOpen={(id) => open({ type: "journey", id })}
                      onRediscover={onMemory}
                    />
                    <Link className="text-link" href="/memories">
                      All family memories <ArrowRight size={16} />
                    </Link>
                  </section>
                  <aside className="today-aside">
                    <div className="section-heading">
                      <h2>A little time together</h2>
                    </div>
                    {nextCall ? (
                      <CallCard
                        call={nextCall}
                        data={data}
                        prepare={() => generate("call", nextCall.id)}
                        busy={busy}
                      />
                    ) : (
                      <div className="call-card">
                        <span className="call-icon">
                          <Video />
                        </span>
                        <h3>No upcoming call</h3>
                        <button
                          className="button secondary"
                          onClick={() => open({ type: "schedule" })}
                        >
                          Plan a family call
                        </button>
                      </div>
                    )}
                    {primary && pending.length > 0 && (
                      <Link href="/review" className="review-nudge">
                        <Inbox size={21} />
                        <span>
                          <strong>
                            {pending.length}{" "}
                            {pending.length === 1 ? "memory" : "memories"}{" "}
                            waiting
                          </strong>
                          <small>Ready for your review</small>
                        </span>
                        <ChevronRight size={18} />
                      </Link>
                    )}
                    <section className="briefing-section">
                      <div className="section-heading">
                        <div>
                          <span className="section-kicker">
                            <Sparkles size={16} /> Just for you
                          </span>
                          <h2>Your family briefing</h2>
                        </div>
                        <button
                          className="button secondary"
                          disabled={busy || activeJobs.length > 0}
                          onClick={() => generate("briefing")}
                        >
                          <RefreshCw size={17} />
                          {briefing
                            ? "Refresh briefing"
                            : "Prepare my briefing"}
                        </button>
                      </div>
                      {briefing ? (
                        <BriefView
                          artifact={briefing}
                          data={data}
                          onMemory={(id) => open({ type: "memory", id })}
                        />
                      ) : (
                        <div className="brief-placeholder">
                          <Leaf size={26} />
                          <p>
                            {approved.length
                              ? "Your approved family updates are ready whenever you are."
                              : "Approved updates will be gathered here."}
                          </p>
                        </div>
                      )}
                    </section>
                  </aside>
                </div>
              </>
            )}

            {(view === "memories" ||
              view === "review" ||
              view === "contribute") && (
              <>
                {view === "memories" && <MemorySections current="memories" />}
                {view === "memories" && <PhotoCollections onMemory={onMemory} />}
                {view === "memories" && (
                  <Moments
                    moments={moments}
                    onOpen={(id) => open({ type: "journey", id })}
                  />
                )}
                <div className="collection-toolbar">
                  <label className="search-field">
                    <Search size={19} />
                    <input
                      aria-label="Find a memory"
                      placeholder="Find a memory, a person, a moment…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  {view === "memories" && (
                    <div className="segments">
                      {["all", "photo", "voice", "story"].map((f) => (
                        <button
                          key={f}
                          aria-pressed={filter === f}
                          onClick={() => setFilter(f)}
                        >
                          {f === "all"
                            ? "All memories"
                            : f === "photo"
                              ? "Photos"
                              : f === "voice"
                                ? "Voices"
                                : "Stories"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="memory-grid vault-grid">
                  {visibleMemories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      data={data}
                      onOpen={() => open({ type: "memory", id: memory.id })}
                    />
                  ))}
                </div>
                {!visibleMemories.length && (
                  <Empty
                    icon={<BookHeart size={36} />}
                    title={
                      search || (view === "memories" && filter !== "all")
                        ? "No matching memories"
                        : view === "review"
                          ? "All caught up"
                          : "No memories here yet"
                    }
                  >
                    {search || (view === "memories" && filter !== "all") ? (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        <RefreshCw size={17} /> Clear filters
                      </button>
                    ) : (
                      view !== "review" && (
                        <button
                          className="button secondary"
                          onClick={() => open({ type: "contribute" })}
                        >
                          Add a family memory
                        </button>
                      )
                    )}
                  </Empty>
                )}
              </>
            )}

            {view === "family" && (
              <>
                <PeopleSections current="family" />
                <div className="section-heading">
                  <p className="muted">The people who make your days.</p>
                  {primary && (
                    <div className="button-row">
                      <button
                        className="button secondary"
                        onClick={() => open({ type: "invite" })}
                      >
                        <Users size={17} />
                        Invite family
                      </button>
                    </div>
                  )}
                </div>
                <div className="people-grid">
                  {data.people.map((person) => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      data={data}
                      onEdit={() => open({ type: "person", id: person.id })}
                      onMemory={onMemory}
                      onCall={() => open({ type: "schedule", id: person.id })}
                      onReply={() => {
                        const member = data.members.find(
                          (m) => m.person_id === person.id,
                        );
                        if (member) open({ type: "reply", id: member.id });
                      }}
                    />
                  ))}
                </div>
                {!data.people.length && (
                  <Empty
                    icon={<Users size={36} />}
                    title="A place for your people"
                  >
                    <button
                      className="button primary"
                      onClick={() => open({ type: "person" })}
                    >
                      Add a familiar person
                    </button>
                  </Empty>
                )}
              </>
            )}

            {view === "calls" && (
              <>
                <RitualInvitation />
                <Link className="make-memory-invitation" href="/conversation">
                  <Video size={20} />
                  <span>Conversation companion</span>
                  <ArrowRight size={18} />
                </Link>
                <div className="section-heading">
                  <h2>Upcoming conversations</h2>
                  <span className="small muted">{data.family.timezone}</span>
                </div>
                <div className="calls-list">
                  {upcoming.map((call) => (
                    <section className="call-detail" key={call.id}>
                      <CallCard
                        call={call}
                        data={data}
                        prepare={() => generate("call", call.id)}
                        busy={busy || activeJobs.length > 0}
                      />
                      <div className="call-context">
                        {data.artifacts.find((a) => a.call_id === call.id) ? (
                          <BriefView
                            artifact={
                              data.artifacts.find((a) => a.call_id === call.id)!
                            }
                            data={data}
                            onMemory={(id) => open({ type: "memory", id })}
                          />
                        ) : (
                          <>
                            <span className="section-kicker">
                              <BookHeart size={16} /> Before you connect
                            </span>
                            <h3>A familiar place to begin</h3>
                            <p>
                              {data.people.find((p) => p.id === call.person_id)
                                ?.about ||
                                "Family updates and conversation topics will appear after you prepare this call."}
                            </p>
                          </>
                        )}
                        {(primary || call.created_by === data.member.id) && (
                          <button
                            className="button quiet danger"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm("Cancel this scheduled call?"))
                                void act("call-cancel", { id: call.id });
                            }}
                          >
                            Cancel scheduled call
                          </button>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
                {!upcoming.length && (
                  <Empty
                    icon={<CalendarDays size={36} />}
                    title="No calls scheduled"
                  >
                    <button
                      className="button primary"
                      onClick={() => open({ type: "schedule" })}
                    >
                      Plan a family call
                    </button>
                  </Empty>
                )}
              </>
            )}

            {view === "messages" && (
              <>
                <MessageSections current="messages" />
                <div className="segments message-tabs">
                  {["all", "inbox", "drafts", "sent"].map((f) => (
                    <button
                      key={f}
                      aria-pressed={(filter === "all" ? "all" : filter) === f}
                      onClick={() => setFilter(f)}
                    >
                      {f === "all"
                        ? "All messages"
                        : f === "inbox"
                          ? "Received"
                          : f === "drafts"
                            ? "My drafts"
                            : "Sent"}
                    </button>
                  ))}
                </div>
                <div className="messages-list">
                  {visibleMessages.map((message) => (
                    <article className="message-item" key={message.id}>
                      <div className="author-row">
                        <Avatar
                          src={personFor(data, message.sender_id)?.avatar}
                          name={message.sender_name ?? "Family"}
                        />
                        <span>
                          <strong>
                            {message.sender_id === data.member.id
                              ? `To ${message.recipient_name}`
                              : `From ${message.sender_name}`}
                          </strong>
                          <small>
                            {dateLabel(
                              message.created_at,
                              data.family.timezone,
                              true,
                            )}
                          </small>
                        </span>
                        <span
                          className={`badge ${message.status === "draft" ? "pending" : "approved"}`}
                        >
                          {message.status === "draft"
                            ? "Private draft"
                            : message.status === "opened"
                              ? "Opened"
                              : "Delivered to inbox"}
                        </span>
                      </div>
                      {message.text && (
                        <p className="message-text">{message.text}</p>
                      )}
                      {message.media_id && (
                        <audio
                          controls
                          src={`/api/media/${message.media_id}`}
                          aria-label={`Voice message from ${message.sender_name}`}
                        />
                      )}
                      <div className="button-row">
                        {message.status === "draft" ? (
                          <>
                            <button
                              className="button primary"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Send this exact reply to ${message.recipient_name}?`,
                                  )
                                )
                                  void act("reply-send", {
                                    id: message.id,
                                    revision: message.revision,
                                  });
                              }}
                            >
                              <Send size={17} />
                              Approve and send to {message.recipient_name}
                            </button>
                            <button
                              className="icon-button danger"
                              title="Discard draft"
                              aria-label="Discard draft"
                              disabled={busy}
                              onClick={() =>
                                act("reply-delete", { id: message.id })
                              }
                            >
                              <Trash2 size={19} />
                            </button>
                          </>
                        ) : message.recipient_id === data.member.id ? (
                          <>
                            <button
                              className="button secondary"
                              onClick={() =>
                                open({ type: "reply", id: message.sender_id })
                              }
                            >
                              <Mic size={18} />
                              Reply
                            </button>
                            {message.status === "delivered" && (
                              <button
                                className="button quiet"
                                onClick={() =>
                                  act("reply-open", { id: message.id })
                                }
                              >
                                <Check size={17} />
                                Mark opened
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="button quiet danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Remove this reply from Togetherly? A downloaded or heard copy cannot be recalled.",
                                )
                              )
                                void act("reply-delete", { id: message.id });
                            }}
                          >
                            Remove from Togetherly
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!visibleMessages.length && (
                  <Empty
                    icon={<MessageCircle size={36} />}
                    title="Your conversations, in your own time"
                  >
                    <button
                      className="button primary"
                      onClick={() => open({ type: "reply" })}
                    >
                      <Mic size={18} />
                      Record a reply
                    </button>
                  </Empty>
                )}
              </>
            )}

            {view === "choices" && (
              <>
                <Choices
                  data={data}
                  act={act}
                  busy={busy}
                  invite={() => open({ type: "invite" })}
                />
                <CompanionChoices />
              </>
            )}
            {view === "rituals" && <ConnectionRituals onMemory={onMemory} />}
            {view === "stories" && (
              <FamilyStories onMemory={onMemory} onAdd={onAdd} />
            )}
            {view === "activities" && (
              <FamilyActivities onMemory={onMemory} onAdd={onAdd} />
            )}
            {view === "walks" && <MemoryWalks onMemory={onMemory} />}
            {view === "family-tree" && (
              <FamilyTree onMemory={onMemory} onReply={onReply} />
            )}
            {view === "insights" && <WhatMatters onMemory={onMemory} />}
            {view === "conversation" && (
              <ConversationCompanion
                key={initialPersonId}
                initialPersonId={initialPersonId}
                onMemory={onMemory}
                onReply={onReply}
              />
            )}
            {view === "capsules" && (
              <>
                <MessageSections current="capsules" />
                <MemoryCapsules familyAction={act} />
              </>
            )}
            <footer className="workspace-footer">
              <HeartHandshake size={16} />
              <span>Because relationships deserve remembering.</span>
              <Link href="/choices">
                <ShieldCheck size={14} /> Your choices
              </Link>
            </footer>
          </main>
        </div>
        <nav
          className="mobile-tabs"
          aria-label="Quick navigation"
          inert={mobileMenu}
        >
          {navigation.map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={activeView === key ? "page" : undefined}
            >
              <Icon size={22} />
              <span>{key === "family" ? "People" : label}</span>
              {key === "messages" && unread > 0 && (
                <i aria-label={`${unread} unread messages`} />
              )}
            </Link>
          ))}
        </nav>
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
          </div>
        )}
        {dialog?.type === "contribute" && (
          <ContributeForm
            {...props}
            initialKind={dialog.kind}
            initialPersonId={dialog.personId}
          />
        )}
        {dialog?.type === "memory" && currentMemory && (
          <MemoryDetail {...props} memory={currentMemory} />
        )}
        {dialog?.type === "journey" && (
          <MemoryJourney
            key={dialog.id}
            moment={(view === "today" ? homeMoments : moments).find(
              (m) => m.id === dialog.id,
            )}
            data={data}
            onClose={close}
            onInspect={(id) => open({ type: "memory", id })}
            onReply={(id) => open({ type: "reply", id })}
          />
        )}
        {dialog?.type === "reply" && (
          <ReplyForm
            {...props}
            recipientId={dialog.id}
            onClose={() => {
              close();
              router.push("/messages");
            }}
          />
        )}
        {dialog?.type === "schedule" && (
          <CallForm {...props} personId={dialog.id} />
        )}
        {dialog?.type === "invite" && <InviteForm {...props} />}
        {dialog?.type === "person" && (
          <PersonForm {...props} personId={dialog.id} />
        )}
        {dialog?.type === "consent" && (
          <Modal title="Your permission comes first" onClose={close}>
            <div className="form-stack">
              <ShieldCheck className="consent-symbol" size={38} />
              <p>
                Nebius will process approved text captions and family names to
                prepare daily briefings, scheduled call notes, and requested
                personal details. Automatic personal details have a separate
                opt-in in My choices. Photo processing has a separate permission;
                original voice recordings are not sent to AI.
              </p>
              <p>
                This permission continues until you turn it off in My choices.
                It does not allow sending messages. The model provider can read
                the selected text.
              </p>
              {primary ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act("settings", {
                        language: data.family.language,
                        timezone: data.family.timezone,
                        hour: data.family.briefing_hour,
                        cloud: true,
                      })
                    ) {
                      const callId = dialog.id ?? null;
                      if (
                        await act("generate", {
                          kind: callId ? "call" : "briefing",
                          callId,
                        })
                      )
                        close();
                    }
                  }}
                >
                  <Check size={18} />
                  Allow and prepare this brief
                </button>
              ) : (
                <p>
                  The primary user must approve AI processing in My choices.
                </p>
              )}
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="button secondary" onClick={close}>
                Not now
              </button>
            </div>
          </Modal>
        )}
        {dialog?.type === "search" && (
          <Modal title="Find a family memory" onClose={close}>
            <label className="search-field">
              <Search size={20} />
              <input
                autoFocus
                value={search}
                placeholder="A name, a story, a moment…"
                aria-label="Search all memories"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="search-results">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => open({ type: "memory", id: m.id })}
                >
                  <BookHeart size={20} />
                  <span>
                    <strong>{m.title}</strong>
                    <small>{m.caption.slice(0, 100)}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
              {!searchResults.length && (
                <Empty icon={<Search size={28} />} title="No matching memories">
                  <button
                    className="button secondary"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </button>
                </Empty>
              )}
            </div>
          </Modal>
        )}
        {dialog?.type === "notifications" && (
          <Modal title="Your reminders" onClose={close}>
            <div className="notification-center">
              {anniversaryNotices.map((notice) => (
                <article
                  className={`notification-item ${notice.readAt ? "is-read" : "is-new"}`}
                  key={notice.id}
                >
                  <span className="notification-symbol" aria-hidden="true">
                    <CalendarDays size={21} />
                  </span>
                  <div>
                    <span className="section-kicker">
                      {notice.readAt ? "Memory anniversary" : "New memory reminder"}
                    </span>
                    <h3>{notice.title}</h3>
                    <p>{notice.text}</p>
                    <small>
                      Remembered date: {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${notice.eventOn}T12:00:00Z`))}
                    </small>
                  </div>
                  <div className="button-row">
                    <button
                      className="button primary"
                      onClick={() => open({ type: "memory", id: notice.sourceId })}
                    >
                      Revisit memory <ArrowRight size={16} />
                    </button>
                    {notice.authorId !== data.member.id && (
                      <button
                        className="button secondary"
                        onClick={() => open({ type: "reply", id: notice.authorId })}
                      >
                        <Mic size={16} /> Plan together
                      </button>
                    )}
                    {!notice.readAt && (
                      <button
                        className="button quiet"
                        disabled={companion.busy}
                        onClick={() => companion.run({ action: "anniversary-read", id: notice.id })}
                      >
                        Mark seen
                      </button>
                    )}
                    <button
                      className="button quiet"
                      disabled={companion.busy}
                      onClick={() => companion.run({ action: "anniversary-dismiss", id: notice.id })}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
              {unread > 0 && (
                <Link className="notification-item notification-message" href="/messages" onClick={close}>
                  <span className="notification-symbol" aria-hidden="true"><MessageCircle size={21} /></span>
                  <div><span className="section-kicker">Family messages</span><h3>{unread} new {unread === 1 ? "message" : "messages"}</h3><p>Open your family inbox to catch up.</p></div>
                  <ArrowRight size={18} />
                </Link>
              )}
              {!anniversaryNotices.length && unread === 0 && (
                <Empty icon={<Bell size={28} />} title="You are all caught up">
                  <p className="muted">Memory anniversaries and family messages will appear here.</p>
                </Empty>
              )}
            </div>
          </Modal>
        )}
      </div>
    </CompanionContext.Provider>
  );
}

function MessageSections({ current }: { current: string }) {
  return (
    <nav className="companion-sections" aria-label="Message collections">
      <Link
        href="/messages"
        aria-current={current === "messages" ? "page" : undefined}
      >
        <MessageCircle size={18} />
        Conversations
      </Link>
      <Link
        href="/capsules"
        aria-current={current === "capsules" ? "page" : undefined}
      >
        <CalendarDays size={18} />
        For later
      </Link>
    </nav>
  );
}

function MemoryCard({
  memory,
  data,
  onOpen,
}: {
  memory: Memory;
  data: Snapshot;
  onOpen: () => void;
}) {
  return (
    <button
      className={`memory-card ${memory.kind === "story" || memory.kind === "update" ? "story-card" : ""}`}
      onClick={onOpen}
    >
      {memory.kind === "photo" && memory.media_id ? (
        <Image
          unoptimized
          width={800}
          height={500}
          className="memory-thumb"
          src={`/api/media/${memory.media_id}`}
          alt={memory.title}
          loading="lazy"
        />
      ) : (
        <div className={`memory-art ${memory.kind}`} aria-hidden="true">
          {memory.kind === "voice" ? (
            <Mic size={35} />
          ) : (
            <BookHeart size={38} />
          )}
          <span>
            {memory.kind === "voice" ? "A familiar voice" : "A family story"}
          </span>
        </div>
      )}
      <span className="memory-card-copy">
        <span className="memory-card-meta">
          {memory.author_name}
          <span>{dateLabel(memory.created_at, data.family.timezone)}</span>
        </span>
        <strong>{memory.title}</strong>
        <span className="memory-excerpt">{memory.caption}</span>
        <span className="memory-card-bottom">
          <span className={`badge ${memory.status}`}>
            {memory.status === "approved"
              ? "In your vault"
              : memory.status === "pending"
                ? "Awaiting review"
                : "Declined"}
          </span>
          <ChevronRight size={18} />
        </span>
      </span>
    </button>
  );
}
function CallCard({
  call,
  data,
  prepare,
  busy,
}: {
  call: Call;
  data: Snapshot;
  prepare: () => void;
  busy: boolean;
}) {
  const person = data.people.find((p) => p.id === call.person_id);
  const isContact = data.member.person_id === call.person_id;
  const name = isContact
    ? data.family.primary_name
    : (person?.name ?? "Family");
  return (
    <article className="call-card">
      <span className="section-kicker">
        <Video size={17} /> Your next conversation
      </span>
      <Avatar
        src={isContact ? undefined : person?.avatar}
        name={name}
        size="large"
      />
      <h3>{name}</h3>
      <p className="relationship">
        {isContact
          ? "Your scheduled family call"
          : person?.relationship_label ?? "Family member"}
      </p>
      <div className="call-time">
        <CalendarDays size={17} />
        {dateLabel(call.scheduled_at, data.family.timezone, true)}
      </div>
      {call.note && <p className="call-note">{call.note}</p>}
      <button className="button primary wide" disabled={busy} onClick={prepare}>
        <Sparkles size={17} />
        Prepare my call
      </button>
      <Link
        className="text-link"
        href={`/conversation?person=${call.person_id}`}
      >
        Open companion <ArrowRight size={16} />
      </Link>
    </article>
  );
}
function PersonCard({
  person,
  data,
  onCall,
  onReply,
  onEdit,
  onMemory,
}: {
  person: Person;
  data: Snapshot;
  onCall: () => void;
  onReply: () => void;
  onEdit: () => void;
  onMemory: (id: string) => void;
}) {
  const member = data.members.find(
    (m) => m.person_id === person.id && m.active && m.id !== data.member.id,
  );
  return (
    <article className="person-card">
      <Avatar src={person.avatar} name={person.name} size="portrait" />
      <h2>{person.name}</h2>
      <span className="relationship">
        {person.relationship_label ?? person.relationship}
      </span>
      <p>{person.about || "A familiar person in your family space."}</p>
      <PersonCompanion person={person} onMemory={onMemory} onReply={onReply} />
      <div className="button-row">
        {data.member.role === "primary" && (
          <button
            className="icon-button"
            onClick={onEdit}
            title={`Correct details for ${person.name}`}
            aria-label={`Correct details for ${person.name}`}
          >
            <Pencil size={18} />
          </button>
        )}
        {(data.member.role === "primary" || data.member.can_schedule === 1) && (
          <button className="button secondary" onClick={onCall}>
            <Video size={17} />
            Plan a call
          </button>
        )}
        {member && (
          <button className="button secondary" onClick={onReply}>
            <Mic size={17} />
            Reply
          </button>
        )}
      </div>
    </article>
  );
}
function BriefView({
  artifact,
  data,
  onMemory,
}: {
  artifact: Artifact;
  data: Snapshot;
  onMemory: (id: string) => void;
}) {
  const content = JSON.parse(artifact.content) as BriefContent;
  return (
    <div className="brief-view">
      <div className="brief-meta">
        <span>
          <Sparkles size={15} />
          {artifact.provider === "token-factory"
            ? "Prepared with Nemotron"
            : artifact.provider === "no-sources"
              ? "No approved sources"
              : "Fixture brief"}
        </span>
        <span>
          {dateLabel(artifact.created_at, data.family.timezone, true)}
        </span>
      </div>
      {content.items.length ? (
        <div className="brief-items">
          {content.items.map((item, i) => (
            <article className="brief-item" key={item.sourceId}>
              <span className="brief-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p lang={artifact.language}>{item.text}</p>
                {item.text !== item.quote && (
                  <details className="brief-evidence">
                    <summary>{item.evidenceId ? "Reviewed photo details" : "Original words"}</summary>
                    <p>{item.quote}</p>
                  </details>
                )}
                <button
                  className="source-link"
                  onClick={() => onMemory(item.sourceId)}
                >
                  <BookHeart size={14} />
                  {data.memories.find((m) => m.id === item.sourceId)?.title ??
                    "Source memory"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          There are no approved updates for this brief yet. Nothing has been
          guessed.
        </p>
      )}
      {artifact.kind === "call" && content.topics.length > 0 && (
        <div className="conversation-topics">
          <h3>A place to begin</h3>
          {content.version === 2
            ? content.items.flatMap((item) => (item.starters ?? []).map((topic) => (
              <div className="conversation-topic" key={`${item.sourceId}-${topic}`}>
                <p lang={artifact.language}><MessageCircle size={17} />{topic}</p>
                <button className="source-link" onClick={() => onMemory(item.sourceId)}>
                  <BookHeart size={14} />Original memory<ChevronRight size={14} />
                </button>
              </div>
            )))
            : content.topics.map((topic) => (
              <p key={topic}><MessageCircle size={17} />{topic}</p>
            ))}
        </div>
      )}
      {content.items.length > 0 && (
        <LocalReadAloud
          text={content.items.map((i) => i.text).join(" ")}
          language={artifact.language}
        />
      )}
    </div>
  );
}
function AccessRow({
  member,
  act,
  busy,
}: {
  member: Member;
  act: Action;
  busy: boolean;
}) {
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act("access", {
      id: member.id,
      active: f.has("active"),
      view: f.has("view"),
      contribute: f.has("contribute"),
      schedule: f.has("schedule"),
      expiresAt: f.get("expiry")
        ? new Date(String(f.get("expiry"))).getTime()
        : null,
    });
  }
  return (
    <form className="access-row" onSubmit={save}>
      <div>
        <strong>{member.name}</strong>
        <span className="muted small">{member.relationship}</span>
      </div>
      <div className="access-checkboxes">
        {(
          [
            ["active", "Access", member.active],
            ["view", "Shared memories", member.can_view],
            ["contribute", "Contribute", member.can_contribute],
            ["schedule", "Schedule calls", member.can_schedule],
          ] as const
        ).map(([name, label, checked]) => (
          <label className="check-label" key={name}>
            <input
              name={name}
              type="checkbox"
              defaultChecked={Boolean(checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <label className="small">
        Access expires
        <input
          name="expiry"
          type="date"
          defaultValue={
            member.expires_at
              ? new Date(member.expires_at).toISOString().slice(0, 10)
              : ""
          }
        />
      </label>
      <button className="button secondary" disabled={busy}>
        Save access
      </button>
    </form>
  );
}
function Choices({
  data,
  act,
  busy,
  invite,
}: {
  data: Snapshot;
  act: Action;
  busy: boolean;
  invite: () => void;
}) {
  const primary = data.member.role === "primary";
  const router = useRouter();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act("settings", {
      language: f.get("language"),
      timezone: f.get("timezone"),
      hour: Number(f.get("hour")),
      cloud: f.has("cloud"),
    });
  }
  return (
    <div className="settings-page">
      <section className="settings-section">
        <div className="settings-title">
          <Settings2 size={23} />
          <div>
            <h2>Your daily rhythm</h2>
            <p>Briefing preferences</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={save}>
          <div className="form-two">
            <label>
              Briefing language
              <select
                name="language"
                defaultValue={data.family.language}
                disabled={!primary}
              >
                <option value="en">English · source excerpts</option>
                <option value="hi">Hindi · AI translation with original</option>
              </select>
            </label>
            <label>
              Time zone
              <select
                name="timezone"
                defaultValue={data.family.timezone}
                disabled={!primary}
              >
                {[
                  "Asia/Kolkata",
                  "Europe/London",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Asia/Singapore",
                  "Australia/Sydney",
                  "UTC",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Daily briefing at
            <select
              name="hour"
              defaultValue={data.family.briefing_hour}
              disabled={!primary}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option value={h} key={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <label className="consent-choice">
            <input
              type="checkbox"
              name="cloud"
              defaultChecked={Boolean(data.family.cloud_consent)}
              disabled={!primary}
            />
            <span>
              <strong>Allow AI family briefings and personal details</strong>
              <small>
                Nebius receives approved text captions and family names for
                daily briefings, call preparation, and requested personal
                details. Automatic suggestions have a separate opt-in below.
                Photo processing has a separate permission below. Original audio
                is not sent. Turn off to stop future processing.
              </small>
            </span>
          </label>
          {primary && (
            <button className="button primary" disabled={busy}>
              <Check size={18} />
              Save preferences
            </button>
          )}
        </form>
      </section>
      {primary && (
        <section className="settings-section">
          <div className="section-heading">
            <div className="settings-title">
              <Users size={23} />
              <div>
                <h2>People you trust</h2>
                <p>Access can be changed at any time.</p>
              </div>
            </div>
            <button className="button secondary" onClick={invite}>
              <Plus size={17} />
              Invite
            </button>
          </div>
          {data.members
            .filter((m) => m.role !== "primary")
            .map((m) => (
              <AccessRow
                key={`${m.id}-${m.active}-${m.expires_at}`}
                member={m}
                act={act}
                busy={busy}
              />
            ))}
          {!data.members.some((m) => m.role === "relative") && (
            <p className="muted">No family members have joined yet.</p>
          )}
        </section>
      )}
      <section className="settings-section">
        <div className="settings-title">
          <ShieldCheck size={23} />
          <div>
            <h2>Your memories, your control</h2>
            <p>Original sources stay available for inspection.</p>
          </div>
        </div>
        <div className="privacy-details">
          <p>
            Uploaded photos and recordings are encrypted on disk. The server
            holds the encryption key. Text captions and account records are
            stored in the application database; this is not end-to-end
            encryption.
          </p>
          <p>
            Deleting a memory removes it and dependent briefs from Togetherly.
            Previously downloaded copies, backups, and text already processed by
            a model provider cannot be recalled.
          </p>
        </div>
        <a className="button secondary" href="/api/export" download>
          <Download size={18} />
          Export my accessible memories
        </a>
      </section>
      <section className="settings-section">
        <div className="settings-title">
          <Sparkles size={23} />
          <div>
            <h2>Assistant activity</h2>
            <p>Daily briefing · Call preparation · Approved reply delivery</p>
          </div>
        </div>
        <dl className="details-list">
          <div>
            <dt>Model</dt>
            <dd>{data.provider.model ?? "Offline fixture mode"}</dd>
          </div>
          <div>
            <dt>Background worker</dt>
            <dd>
              {data.worker.heartbeat
                ? `${data.now - data.worker.heartbeat < 180000 ? "Connected" : "Last seen"} · ${dateLabel(data.worker.heartbeat, data.family.timezone, true)}`
                : "Not connected"}
            </dd>
          </div>
          <div>
            <dt>Cloud permission</dt>
            <dd>
              {data.family.cloud_consent ? "Allowed for approved text" : "Off"}
            </dd>
          </div>
        </dl>
        {data.jobs
          .filter((j) => j.status === "failed" || j.status === "cancelled")
          .slice(0, 3)
          .map((job) => (
            <div className="failed-job" key={job.id}>
              <span>
                <strong>
                  {job.kind === "call" ? "Call preparation" : "Family briefing"}
                  : {job.status}
                </strong>
                <small>{job.error}</small>
              </span>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => act("job", { id: job.id, operation: "retry" })}
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          ))}
        <details>
          <summary>Recent receipts</summary>
          <ul className="receipt-list">
            {data.receipts.map((r) => (
              <li key={r.id}>
                <Check size={15} />
                <span>
                  {r.summary}
                  <small>
                    {dateLabel(r.created_at, data.family.timezone, true)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>
      {data.family.is_demo === 1 && (
        <section className="settings-section demo-settings">
          <h2>Sample family accounts</h2>
          <p>
            This fictional family is isolated to this visit. Switch accounts to
            test contribution, review, and delivery. Real families do not have
            this control.
          </p>
          <div className="button-row">
            {data.members
              .filter((m) => m.active)
              .map((m) => (
                <button
                  className="button secondary"
                  disabled={m.id === data.member.id}
                  key={m.id}
                  onClick={async () => {
                    const response = await fetch("/api/account", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "demo-person",
                        memberId: m.id,
                      }),
                    });
                    if (response.ok) {
                      router.push("/");
                      router.refresh();
                    }
                  }}
                >
                  {m.name} ·{" "}
                  {m.role === "primary" ? "Primary user" : m.relationship}
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
