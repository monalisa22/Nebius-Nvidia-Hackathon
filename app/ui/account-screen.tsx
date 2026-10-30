"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { TogetherlyBrand } from "./togetherly-brand";

export function AccountScreen({
  invitation,
  invalidInvitation = false,
}: {
  invitation?: { token: string; name: string; family: string } | null;
  invalidInvitation?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event?: FormEvent<HTMLFormElement>, demo = false) {
    event?.preventDefault();
    setError("");
    setBusy(true);
    const fields = event
      ? Object.fromEntries(new FormData(event.currentTarget))
      : {};
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          action: demo ? "demo" : invitation ? "join" : mode,
          token: invitation?.token,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <h1 className="account-brand">
        <TogetherlyBrand tagline={false} />
      </h1>
      <p className="account-tagline">
        Because relationships deserve remembering.
      </p>
      <div className="account-layout">
        <div className="account-photo" aria-hidden="true">
          <Image
            unoptimized
            loading="eager"
            width={900}
            height={500}
            src="/demo/family.jpg"
            alt=""
          />
          <Image
            unoptimized
            width={500}
            height={500}
            src="/demo/garden.jpg"
            alt=""
          />
        </div>
        <section className="account-form" aria-label="Account access">
          <span className="section-kicker">
            <LockKeyhole size={16} /> Your family space
          </span>
          <h2>
            {invalidInvitation
              ? "Invitation unavailable"
              : invitation
                ? `Welcome, ${invitation.name}`
                : mode === "register"
                  ? "Start your family space"
                  : "Welcome to Togetherly"}
          </h2>
          {invitation && <p>Join {invitation.family}.</p>}
          {invalidInvitation ? (
            <>
              <p>
                This invitation has expired or has already been used. Ask your
                family for a new invitation.
              </p>
              <Link className="button primary" href="/">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              {!invitation && (
                <div className="segments account-tabs">
                  <button
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    aria-pressed={mode === "login"}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    aria-pressed={mode === "register"}
                  >
                    Create family
                  </button>
                </div>
              )}
              <form onSubmit={submit} className="form-stack">
                {!invitation && mode === "register" && (
                  <>
                    <label>
                      Your name
                      <input
                        name="name"
                        autoComplete="given-name"
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Family name
                      <input
                        name="familyName"
                        placeholder="The Sharma family"
                        required
                        maxLength={100}
                      />
                    </label>
                  </>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete={
                      mode === "login" && !invitation
                        ? "current-password"
                        : "new-password"
                    }
                    required
                  />
                </label>
                {(mode === "register" || invitation) && (
                  <small>At least 12 characters.</small>
                )}
                {error && (
                  <p className="error-text" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary wide" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}{" "}
                  {invitation
                    ? "Accept invitation"
                    : mode === "register"
                      ? "Create my family space"
                      : "Sign in"}
                </button>
              </form>
              {!invitation && (
                <div className="demo-entry">
                  <button
                    className="button secondary wide"
                    disabled={busy}
                    onClick={() => submit(undefined, true)}
                  >
                    Open a sample family <ArrowRight size={17} />
                  </button>
                  <small>
                    Fictional family. A separate space for your visit.
                  </small>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <footer className="account-footer">
        Your stories. Your voice. Your choices.
      </footer>
    </main>
  );
}
