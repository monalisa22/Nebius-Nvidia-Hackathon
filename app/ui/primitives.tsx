"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Mic, Square, RotateCcw, LoaderCircle, Volume2 } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const box = ref.current.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <header className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Avatar({
  src,
  name,
  size = "",
}: {
  src?: string;
  name: string;
  size?: string;
}) {
  return src ? (
    <Image
      unoptimized
      width={120}
      height={120}
      className={`avatar ${size}`}
      src={src}
      alt={name}
    />
  ) : (
    <span className={`avatar initials ${size}`} aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function LocalReadAloud({
  text,
  language = "en",
}: {
  text: string;
  language?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    },
    [],
  );
  function speak() {
    if (typeof speechSynthesis === "undefined") {
      setError("Read aloud is not available in this browser.");
      return;
    }
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.localService && v.lang.startsWith(language));
    if (!voice) {
      setError(
        "No on-device voice is available for this language. Original family recordings can still be played.",
      );
      return;
    }
    setError("");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  }
  return (
    <div>
      <button className="button secondary" onClick={speak}>
        {speaking ? <Square size={17} /> : <Volume2 size={18} />}{" "}
        {speaking ? "Stop reading" : "Read aloud"}
      </button>
      {error && (
        <p className="muted small" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
export function Recorder({ onFile }: { onFile: (file: File | null) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const mounted = useRef(true);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<"idle" | "asking" | "recording" | "ready">(
    "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function start() {
    setError("");
    setState("asking");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is not available in this browser. You can write a reply instead.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        return;
      }
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime)
        throw new Error(
          "This browser does not support a compatible recording format. Write a reply instead.",
        );
      const active = new MediaRecorder(stream.current, { mimeType: mime });
      recorder.current = active;
      const chunks: BlobPart[] = [];
      active.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      active.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (!mounted.current) return;
        const file = new File(chunks, "family-reply", { type: mime });
        setUrl(URL.createObjectURL(file));
        onFile(file);
        setState("ready");
      };
      active.start();
      setState("recording");
      setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => {
        setSeconds(++elapsed);
        if (elapsed >= 120) active.stop();
      }, 1000);
    } catch (error) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (!mounted.current) return;
      setState("idle");
      setError(
        error instanceof Error
          ? error.message
          : "Microphone access was not available.",
      );
    }
  }
  return (
    <div className="recorder">
      {state === "ready" ? (
        <>
          <audio controls src={url} aria-label="Preview your recording" />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setUrl("");
              setState("idle");
              onFile(null);
            }}
          >
            <RotateCcw size={17} /> Record again
          </button>
        </>
      ) : (
        <button
          type="button"
          className={`record-button ${state === "recording" ? "recording" : ""}`}
          onClick={() =>
            state === "recording" ? recorder.current?.stop() : start()
          }
          disabled={state === "asking"}
        >
          {state === "asking" ? (
            <LoaderCircle className="spin" />
          ) : state === "recording" ? (
            <Square />
          ) : (
            <Mic />
          )}
          <span>
            {state === "asking"
              ? "Opening microphone"
              : state === "recording"
                ? `Stop recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                : "Record a voice reply"}
          </span>
        </button>
      )}
      {state === "idle" && (
        <small>Up to 2 minutes. You can listen before sending.</small>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
