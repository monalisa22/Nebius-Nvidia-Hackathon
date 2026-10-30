"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  FileText,
  ImagePlus,
  Mic,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import type { Memory, Snapshot } from "@/lib/anubandh/types";
import { Avatar, LocalReadAloud, Modal, Recorder } from "./primitives";
import { MemoryEnrichment } from "./companion-people";
import { PhotoInsights } from "./photo-memories";

export type Action = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
type Props = {
  data: Snapshot;
  act: Action;
  onClose: () => void;
  busy: boolean;
  error: string;
};
export async function upload(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.id as string;
}
function Issue({ error }: { error: string }) {
  return error ? (
    <p className="error-text" role="alert">
      {error}
    </p>
  ) : null;
}
export function ContributeForm({
  data,
  act,
  onClose,
  busy,
  error,
  initialKind,
  initialPersonId,
}: Props & { initialKind?: Memory["kind"]; initialPersonId?: string }) {
  const [kind, setKind] = useState<Memory["kind"]>(initialKind ?? "photo");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLocalError("");
    setUploading(true);
    try {
      if ((kind === "photo" || kind === "voice") && !file)
        throw new Error("Choose a photo or record a voice message first.");
      const mediaId = file ? await upload(file) : null;
      const result = await act("memory-add", {
        title: form.get("title"),
        caption: form.get("caption"),
        kind,
        personIds: form.getAll("people"),
        audience: form.get("sharing") === "private" ? [] : ["*"],
        mediaId,
        expiresAt: form.get("expiry")
          ? new Date(String(form.get("expiry"))).getTime()
          : null,
      });
      if (result) onClose();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal title="Add a family memory" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="segments" aria-label="Memory type">
          {(
            [
              ["photo", ImagePlus, "Photo"],
              ["voice", Mic, "Voice"],
              ["story", FileText, "Story"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setFile(null);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        {kind === "photo" && (
          <label className="upload-zone">
            <ImagePlus size={30} />
            <span>{file?.name ?? "Choose a family photograph"}</span>
            <small>JPEG, PNG or WebP · up to 8 MB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        {kind === "voice" && (
          <>
            <Recorder onFile={setFile} />
            <label>
              Or upload an original recording
              <input
                type="file"
                accept="audio/webm,audio/ogg,audio/wav,audio/mpeg,audio/mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && <span className="small muted">Selected: {file.name}</span>}
          </>
        )}
        <label>
          Title
          <input
            name="title"
            required
            maxLength={200}
            placeholder="A moment worth sharing"
          />
        </label>
        <label>
          {kind === "voice"
            ? "What the recording is about"
            : "The details you know"}
          <textarea
            name="caption"
            required={kind !== "photo"}
            maxLength={4000}
            rows={4}
            placeholder="Names, what happened, and anything you want to share."
          />
        </label>
        <fieldset>
          <legend>People in this memory</legend>
          <div className="choice-list">
            {data.people.map((p) => (
              <label key={p.id} className="check-label">
                <input
                  type="checkbox"
                  name="people"
                  value={p.id}
                  aria-label={p.name}
                  defaultChecked={p.id === initialPersonId}
                />
                <Avatar src={p.avatar} name={p.name} size="tiny" />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-two">
          <label>
            Share after approval
            <select name="sharing">
              <option value="family">Family members with viewing access</option>
              <option value="private">Primary user and contributor only</option>
            </select>
          </label>
          <label>
            Expires on (optional)
            <input
              type="date"
              name="expiry"
              min={new Date(data.now + 86400000).toISOString().slice(0, 10)}
            />
          </label>
        </div>
        <p className="disclosure">
          <ShieldCheck size={18} />
          Stored privately for review. Photo AI is optional and requested separately after approval. Your original story stays intact.
        </p>
        <Issue error={localError || error} />
        <button className="button primary" disabled={busy || uploading}>
          <Upload size={18} />
          {uploading ? "Saving contribution…" : "Save for review"}
        </button>
      </form>
    </Modal>
  );
}
export function MemoryDetail({
  memory,
  data,
  act,
  onClose,
  busy,
  error,
}: Props & { memory: Memory }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const primary = data.member.role === "primary";
  async function edit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await act("memory-edit", {
        id: memory.id,
        revision: memory.revision,
        title: f.get("title"),
        caption: f.get("caption"),
        expiresAt: f.get("expiry")
          ? new Date(String(f.get("expiry"))).getTime()
          : null,
        audience: f.getAll("audience"),
        personIds: f.getAll("people"),
      })
    )
      onClose();
  }
  return (
    <Modal
      title={editing ? "Correct this memory" : memory.title}
      onClose={onClose}
      wide
    >
      {memory.media_id && memory.kind === "photo" && (
        <Image
          unoptimized
          width={1000}
          height={700}
          className="detail-photo"
          src={`/api/media/${memory.media_id}`}
          alt={memory.title}
        />
      )}
      {memory.media_id && memory.kind === "voice" && (
        <audio
          className="full-audio"
          controls
          src={`/api/media/${memory.media_id}`}
          aria-label={memory.title}
        />
      )}
      <div className="source-meta">
        <span className={`badge ${memory.status}`}>
          {memory.status === "pending"
            ? "Waiting for your review"
            : memory.status}
        </span>
        <span>
          From{" "}
          {memory.author_name ??
            data.members.find((m) => m.id === memory.author_id)?.name}
        </span>
      </div>
      {editing ? (
        <form className="form-stack" onSubmit={edit}>
          <label>
            Title
            <input
              name="title"
              defaultValue={memory.title}
              required
              maxLength={200}
            />
          </label>
          <label>
            Known details
            <textarea
              name="caption"
              defaultValue={memory.caption}
              rows={5}
              required={memory.kind !== "photo"}
              maxLength={4000}
            />
          </label>
          <fieldset>
            <legend>People in this memory</legend>
            {data.people.map((person) => (
              <label className="check-label" key={person.id}>
                <input
                  name="people"
                  type="checkbox"
                  value={person.id}
                  defaultChecked={JSON.parse(memory.person_ids).includes(
                    person.id,
                  )}
                />
                {person.name}
              </label>
            ))}
          </fieldset>
          <label>
            Expires on
            <input
              name="expiry"
              type="date"
              defaultValue={
                memory.expires_at
                  ? new Date(memory.expires_at).toISOString().slice(0, 10)
                  : ""
              }
            />
          </label>
          <fieldset>
            <legend>Who may view this memory?</legend>
            <label className="check-label">
              <input
                type="checkbox"
                name="audience"
                value="*"
                defaultChecked={JSON.parse(memory.audience).includes("*")}
              />
              All family members with viewing access
            </label>
            {data.members
              .filter((m) => m.role !== "primary")
              .map((m) => (
                <label className="check-label" key={m.id}>
                  <input
                    name="audience"
                    type="checkbox"
                    value={m.id}
                    defaultChecked={JSON.parse(memory.audience).includes(m.id)}
                  />
                  {m.name}
                </label>
              ))}
            <small>
              The primary user and original contributor retain access.
            </small>
          </fieldset>
          <Issue error={error} />
          <div className="button-row">
            <button className="button primary" disabled={busy}>
              <Save size={18} />
              Save correction
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="memory-caption">{memory.caption}</p>
          <LocalReadAloud text={memory.caption} />
          <dl className="details-list">
            <div>
              <dt>Added</dt>
              <dd>
                {new Date(memory.created_at).toLocaleDateString("en", {
                  dateStyle: "long",
                  timeZone: data.family.timezone,
                })}
              </dd>
            </div>
            <div>
              <dt>People</dt>
              <dd>
                {data.people
                  .filter((p) => JSON.parse(memory.person_ids).includes(p.id))
                  .map((p) => p.name)
                  .join(", ") || "Not tagged"}
              </dd>
            </div>
            <div>
              <dt>Retention</dt>
              <dd>
                {memory.expires_at
                  ? `Until ${new Date(memory.expires_at).toLocaleDateString()}`
                  : "Until you delete it"}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                Contributor-supplied{" "}
                {memory.kind === "voice"
                  ? "caption, not an AI transcript"
                  : "details"}
              </dd>
            </div>
          </dl>
          <MemoryEnrichment memory={memory} />
          <PhotoInsights memory={memory} />
          {primary && (
            <div className="button-row">
              {memory.status !== "approved" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act("memory-review", {
                        id: memory.id,
                        revision: memory.revision,
                        decision: "approved",
                      })
                    )
                      onClose();
                  }}
                >
                  <Check size={18} />
                  Approve memory
                </button>
              )}
              {memory.status === "pending" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act("memory-review", {
                        id: memory.id,
                        revision: memory.revision,
                        decision: "rejected",
                      })
                    )
                      onClose();
                  }}
                >
                  Decline
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => setEditing(true)}
              >
                Correct details
              </button>
              <button
                className="icon-button danger"
                aria-label="Delete memory"
                title="Delete memory"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={19} />
              </button>
            </div>
          )}
          {deleting && (
            <section className="delete-confirm">
              <h3>Delete this memory?</h3>
              <p>
                The photo or recording and briefs based on it will be removed.
                Previously downloaded copies cannot be recalled.
              </p>
              <div className="button-row">
                <button
                  className="button destructive"
                  disabled={busy}
                  onClick={async () => {
                    if (await act("memory-delete", { id: memory.id }))
                      onClose();
                  }}
                >
                  Delete memory
                </button>
                <button
                  className="button secondary"
                  onClick={() => setDeleting(false)}
                >
                  Keep memory
                </button>
              </div>
            </section>
          )}
          <Issue error={error} />
        </>
      )}
    </Modal>
  );
}
export function ReplyForm({
  data,
  act,
  onClose,
  busy,
  error,
  recipientId,
}: Props & { recipientId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const recipients = data.members.filter(
    (m) =>
      m.id !== data.member.id &&
      m.active &&
      (!m.expires_at || m.expires_at > data.now),
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setUploading(true);
    setLocalError("");
    try {
      const mediaId = file ? await upload(file) : null;
      const result = await act("reply-create", {
        recipientId: f.get("recipient"),
        text: f.get("text"),
        mediaId,
      });
      if (result) onClose();
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not save recording.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal title="A reply in your own words" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label>
          To
          <select name="recipient" defaultValue={recipientId} required>
            <option value="">Choose a family member</option>
            {recipients.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.relationship_label ?? m.relationship}
              </option>
            ))}
          </select>
        </label>
        <Recorder onFile={setFile} />
        <label>
          Or write a message
          <textarea
            name="text"
            maxLength={4000}
            rows={4}
            placeholder="What would you like to share?"
          />
        </label>
        <p className="disclosure">
          <ShieldCheck size={18} />
          This saves a private draft. Review it in Messages before sending.
        </p>
        <Issue error={localError || error} />
        <button className="button primary" disabled={busy || uploading}>
          <Save size={18} />
          {uploading ? "Saving…" : "Save reply for review"}
        </button>
      </form>
    </Modal>
  );
}
export function CallForm({
  data,
  act,
  onClose,
  busy,
  error,
  personId,
}: Props & { personId?: string }) {
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await act("call-add", {
        personId: f.get("person"),
        scheduledAt: new Date(String(f.get("when"))).getTime(),
        note: f.get("note"),
      })
    )
      onClose();
  }
  return (
    <Modal title="Plan a family call" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label>
          Who would you like to call?
          <select name="person" defaultValue={personId} required>
            <option value="">Choose someone</option>
            {data.people.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.relationship_label ?? p.relationship}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date and time (your device time)
          <input name="when" type="datetime-local" required />
        </label>
        <label>
          A note for the call
          <textarea name="note" rows={3} maxLength={4000} />
        </label>
        <Issue error={error} />
        <button className="button primary" disabled={busy}>
          Schedule call
        </button>
      </form>
    </Modal>
  );
}
export function InviteForm({ act, onClose, busy, error }: Props) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const result = await act("invite", {
      name: f.get("name"),
      relationship: f.get("relationship"),
      view: f.has("view"),
      contribute: f.has("contribute"),
      schedule: f.has("schedule"),
    });
    if (result) setUrl(`${location.origin}/join/${result.token}`);
  }
  return (
    <Modal title="Invite someone you trust" onClose={onClose}>
      {url ? (
        <div className="form-stack">
          <ShieldCheck size={32} />
          <h3>Your invitation is ready</h3>
          <p>
            This private, one-use link expires in 7 days. Share it only with the
            person you invited.
          </p>
          <label>
            Invitation link
            <input value={url} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="button primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={18} />
            {copied ? "Copied" : "Copy invitation"}
          </button>
        </div>
      ) : (
        <form className="form-stack" onSubmit={invite}>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Relationship to the primary user
            <input
              name="relationship"
              placeholder="Daughter, son, friend…"
              required
              maxLength={100}
            />
          </label>
          <fieldset>
            <legend>They may</legend>
            <label className="check-label">
              <input name="view" type="checkbox" defaultChecked />
              View shared memories
            </label>
            <label className="check-label">
              <input name="contribute" type="checkbox" defaultChecked />
              Add contributions for review
            </label>
            <label className="check-label">
              <input name="schedule" type="checkbox" />
              Schedule family calls
            </label>
          </fieldset>
          <Issue error={error} />
          <button className="button primary" disabled={busy}>
            <Send size={18} />
            Create invitation
          </button>
        </form>
      )}
    </Modal>
  );
}
export function PersonForm({
  data,
  act,
  onClose,
  busy,
  error,
  personId,
}: Props & { personId?: string }) {
  const person = data.people.find((p) => p.id === personId);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await act(person ? "person-edit" : "person-add", {
        ...Object.fromEntries(f),
        ...(person ? { id: person.id } : {}),
      })
    )
      onClose();
  }
  return (
    <Modal
      title={person ? "Correct family details" : "Add a familiar person"}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={save}>
        <label>
          Name
          <input
            name="name"
            defaultValue={person?.name}
            required
            maxLength={100}
          />
        </label>
        <label>
          Relationship
          <input
            name="relationship"
            defaultValue={person?.relationship}
            required
            maxLength={100}
          />
        </label>
        <label>
          Details you want to remember
          <textarea
            name="about"
            defaultValue={person?.about}
            maxLength={4000}
            rows={3}
          />
        </label>
        <Issue error={error} />
        <button className="button primary" disabled={busy}>
          <Users size={18} />
          Save person
        </button>
      </form>
    </Modal>
  );
}
