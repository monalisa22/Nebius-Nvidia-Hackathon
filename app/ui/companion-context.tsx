"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  Compass,
  Footprints,
  LoaderCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { Snapshot } from "@/lib/anubandh/types";
import type { CompanionSnapshot } from "@/lib/togetherly/service";
import type { CompanionCommand } from "@/lib/togetherly/contracts";

export function useCompanionController(
  initial: CompanionSnapshot,
  family: Snapshot,
  refreshFamily: () => Promise<void>,
) {
  const [state, setState] = useState<CompanionSnapshot | null>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    const response = await fetch("/api/companion", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) setState(null);
      throw new Error(
        "Your family space could not be refreshed. Please try again.",
      );
    }
    const next: CompanionSnapshot = await response.json();
    if (version === generation.current) setState(next);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !pending.current)
        void refresh().catch((e) => {
          if (active) setError(e.message);
        });
    }, 5000);
    return () => {
      clearInterval(timer);
      active = false;
    };
  }, [refresh]);
  const run = async (command: CompanionCommand) => {
    if (pending.current) return null;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = (await response.json()) as {
        id?: string;
        revision?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      try {
        await Promise.all([refresh(), refreshFamily()]);
      } catch {
        setError(
          "Your change was saved, but this view could not refresh. Retry the refresh before making another change.",
        );
      }
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection lost. Please try again.",
      );
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    state,
    family,
    busy,
    error,
    run,
    refresh,
    clearError: () => setError(""),
  };
}
export type CompanionController = ReturnType<typeof useCompanionController>;
export const CompanionContext = createContext<CompanionController | null>(null);
export function useCompanion() {
  const context = useContext(CompanionContext);
  if (!context) throw new Error("Companion context is missing.");
  return context;
}
export function CompanionFeedback() {
  const { error, refresh, clearError } = useCompanion();
  return error ? (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button
        className="button quiet"
        onClick={() =>
          void refresh()
            .then(clearError)
            .catch(() => {})
        }
      >
        <RefreshCw size={16} />
        Retry
      </button>
    </div>
  ) : null;
}
export function CompanionLoading() {
  return (
    <p className="companion-loading" role="status">
      <LoaderCircle className="spin" size={18} />
      Opening your family space
    </p>
  );
}
export function MemorySections({ current }: { current: string }) {
  return (
    <nav className="companion-sections" aria-label="Memory collections">
      {[
        { href: "/memories", label: "All memories", Icon: Compass },
        { href: "/stories", label: "Family stories", Icon: BookOpen },
        { href: "/activities", label: "Make a memory", Icon: Plus },
        { href: "/walks", label: "Memory walks", Icon: Footprints },
      ].map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href.slice(1) ? "page" : undefined}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function displayDate(time: number, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
}
export function localInputDate(time: number) {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
