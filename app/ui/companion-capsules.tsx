"use client";
import { useRef, useState } from "react";
import {
  CalendarHeart,
  CalendarDays,
  Check,
  Clock3,
  Mail,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  CompanionFeedback,
  CompanionLoading,
  displayDate,
  localInputDate,
  useCompanion,
} from "./companion-context";
import { Empty, Modal, Recorder } from "./primitives";
import { upload, type Action } from "./forms";

export function MemoryCapsules({ familyAction }: { familyAction: Action }) {
  const { state, family, run, refresh, busy } = useCompanion();
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    revision: number;
    deliver_at: number;
  } | null>(null);
  if (!state) return <CompanionLoading />;
  const recipients = family.members.filter(
    (m) =>
      m.id !== family.member.id &&
      m.active &&
      (!m.expires_at || m.expires_at > family.now),
  );
  const edit = state.capsules.some((c) => c.id === editing?.id)
    ? editing
    : null;
  return (
    <>
      <div className="story-heading capsule-heading">
        <div>
          <span className="section-kicker">
            <CalendarHeart size={17} />A little love, for later
          </span>
          <h2>For a day that matters.</h2>
          <p>Your words. Their future moment.</p>
        </div>
        <button
          className="button primary"
          disabled={!recipients.length}
          onClick={() => {
            setFile(null);
            uploaded.current = null;
            setUploadError("");
            setCreating(true);
          }}
        >
          <Plus size={18} />
          Create a capsule
        </button>
      </div>
      <div className="capsule-grid">
        {state.capsules.map((capsule) => (
          <article
            className={`capsule-card capsule-${capsule.status}`}
            key={capsule.id}
          >
            <div className="capsule-envelope">
              <Mail size={30} />
              <span className="badge">
                {capsule.status === "draft" ? "Private draft" : capsule.status}
              </span>
            </div>
            <span className="section-kicker">
              For{" "}
              {family.members.find((m) => m.id === capsule.recipient_id)?.name}
            </span>
            <h3>{capsule.title}</h3>
            <p className="capsule-letter">{capsule.text}</p>
            {capsule.media_id && (
              <audio
                controls
                preload="metadata"
                src={`/api/media/${capsule.media_id}`}
                aria-label={`Recording for ${capsule.title}`}
              />
            )}
            <p className="capsule-date">
              <CalendarDays size={16} />
              {displayDate(capsule.deliver_at, family.family.timezone)}
            </p>
            <small className="muted">{family.family.timezone}</small>
            {capsule.error && (
              <p className="error-text" role="alert">
                {capsule.error}
              </p>
            )}
            <div className="button-row">
              {capsule.status === "draft" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    const name = family.members.find(
                      (m) => m.id === capsule.recipient_id,
                    )?.name;
                    if (
                      window.confirm(
                        `Approve delivery of this exact message to ${name}'s Togetherly inbox on ${displayDate(capsule.deliver_at, family.family.timezone)}?`,
                      )
                    )
                      void run({
                        action: "capsule-approve",
                        id: capsule.id,
                        revision: capsule.revision,
                      });
                  }}
                >
                  <Send size={16} />
                  Approve delivery
                </button>
              )}
              {capsule.status !== "delivered" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    setEditing({
                      id: capsule.id,
                      revision: capsule.revision,
                      deliver_at: capsule.deliver_at,
                    })
                  }
                >
                  <Clock3 size={16} />
                  Change date
                </button>
              )}
              {capsule.status === "scheduled" && (
                <button
                  className="button quiet"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Cancel this scheduled delivery?"))
                      void run({
                        action: "capsule-cancel",
                        id: capsule.id,
                        revision: capsule.revision,
                      });
                  }}
                >
                  Cancel delivery
                </button>
              )}
              <button
                className="icon-button danger"
                disabled={busy}
                aria-label={`Delete capsule ${capsule.title}`}
                title="Delete capsule"
                onClick={async () => {
                  if (
                    window.confirm(
                      "Delete this capsule and its recording? Previously received copies cannot be recalled.",
                    ) &&
                    (await familyAction("reply-delete", {
                      id: capsule.message_id,
                    }))
                  )
                    await refresh();
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!state.capsules.length && (
        <Empty
          icon={<CalendarHeart size={38} />}
          title="Something to open, someday"
        >
          <button
            className="button secondary"
            disabled={!recipients.length}
            onClick={() => {
              setFile(null);
              uploaded.current = null;
              setUploadError("");
              setCreating(true);
            }}
          >
            Make your first capsule
          </button>
        </Empty>
      )}
      {creating && (
        <Modal
          title="A message for the future"
          onClose={() => {
            if (!uploading) setCreating(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setUploading(true);
              setUploadError("");
              const form = new FormData(e.currentTarget);
              try {
                const mediaId = file
                  ? uploaded.current?.file === file
                    ? uploaded.current.id
                    : await upload(file)
                  : null;
                if (file && mediaId) uploaded.current = { file, id: mediaId };
                const result = await run({
                  action: "capsule-create",
                  title: String(form.get("title")),
                  recipientId: String(form.get("recipient")),
                  text: String(form.get("text")),
                  mediaId,
                  deliverAt: new Date(String(form.get("when"))).getTime(),
                });
                if (result) setCreating(false);
              } catch (error) {
                setUploadError(
                  error instanceof Error
                    ? error.message
                    : "The recording could not be uploaded.",
                );
              } finally {
                setUploading(false);
              }
            }}
          >
            <label>
              For
              <select name="recipient" required>
                <option value="">Choose someone</option>
                {recipients.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                name="title"
                required
                maxLength={200}
                placeholder="For your graduation day"
              />
            </label>
            <Recorder onFile={setFile} />
            <label>
              Your message
              <textarea name="text" rows={4} maxLength={4000} />
            </label>
            <label>
              Delivery time (your device time)
              <input
                type="datetime-local"
                name="when"
                required
                defaultValue={localInputDate(family.now + 7 * 86400000)}
                min={localInputDate(family.now + 60000)}
              />
            </label>
            <p className="small muted">
              Saved as a private draft. Delivery to their Togetherly inbox needs
              your approval.
            </p>
            {uploadError && (
              <p role="alert" className="error-text">
                {uploadError}
              </p>
            )}
            <CompanionFeedback />
            <button className="button primary" disabled={busy || uploading}>
              <Check size={17} />
              {uploading ? "Saving capsule" : "Save private capsule"}
            </button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title="Choose a new moment" onClose={() => setEditing(null)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await run({
                  action: "capsule-reschedule",
                  id: edit.id,
                  revision: edit.revision,
                  deliverAt: new Date(String(form.get("when"))).getTime(),
                })
              )
                setEditing(null);
            }}
          >
            <label>
              Delivery time (your device time)
              <input
                type="datetime-local"
                name="when"
                required
                defaultValue={localInputDate(edit.deliver_at)}
                min={localInputDate(family.now + 60000)}
              />
            </label>
            <p className="small muted">
              A new date returns your capsule to a private draft for fresh
              approval.
            </p>
            <CompanionFeedback />
            <button className="button primary" disabled={busy}>
              <Check size={17} />
              Save new date
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
