"use client";
import { useState } from "react";
import { Check, HeartHandshake, Sparkles } from "lucide-react";
import { PhotoPermission } from "./photo-memories";
import {
  CompanionLoading,
  displayDate,
  useCompanion,
} from "./companion-context";

export function CompanionChoices() {
  const { state, family, run, busy } = useCompanion();
  const [saved, setSaved] = useState(false);
  if (!state) return <CompanionLoading />;
  const preferences = state.preferences;
  const members = family.members.filter(
    (m) =>
      m.id !== family.member.id &&
      m.active &&
      (!m.expires_at || m.expires_at > family.now),
  );
  return (
    <div className="settings-page companion-choices">
      <PhotoPermission />
      <section className="settings-section">
        <div className="settings-title">
          <HeartHandshake size={24} />
          <div>
            <h2>Your connection rhythm</h2>
            <p>Personal choices for {family.member.name}</p>
          </div>
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setSaved(false);
            if (
              await run({
                action: "preferences",
                reminders: form.has("reminders"),
                quietDays: Number(form.get("days")),
                checkinEnabled: form.has("checkin"),
                trustedId: String(form.get("trusted")) || null,
                checkinDays: Number(form.get("checkinDays")),
                autoInsights: form.has("insights"),
                memoryReminders: form.has("memoryReminders"),
              })
            )
              setSaved(true);
          }}
        >
          <label className="check-label">
            <input
              name="memoryReminders"
              type="checkbox"
              defaultChecked={Boolean(preferences.memory_reminders)}
            />
            Memory anniversaries and meaningful dates
          </label>
          <p className="small muted">
            Togetherly uses dates confirmed in Story details to create private
            in-app reminders. Upload dates are never treated as event dates.
          </p>
          <label className="check-label">
            <input
              name="reminders"
              type="checkbox"
              defaultChecked={Boolean(preferences.reminders)}
            />
            Gentle reminders to reconnect
          </label>
          <label>
            Days between recorded connections
            <input
              name="days"
              type="number"
              min={3}
              max={90}
              defaultValue={preferences.quiet_days}
              required
            />
          </label>
          <fieldset className="checkin-fields">
            <legend>A trusted check-in</legend>
            <label className="check-label">
              <input
                name="checkin"
                type="checkbox"
                defaultChecked={Boolean(preferences.checkin_enabled)}
              />
              Let my trusted person know when I miss a check-in
            </label>
            <div className="form-two">
              <label>
                My trusted person
                <select
                  name="trusted"
                  defaultValue={preferences.trusted_id ?? ""}
                >
                  <option value="">Choose a family member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                After how many days?
                <input
                  name="checkinDays"
                  type="number"
                  required
                  min={1}
                  max={30}
                  defaultValue={preferences.checkin_days}
                />
              </label>
            </div>
            <p className="small muted">
              Your chosen person receives a private Togetherly notice when you
              have not recorded a check-in. Turning this off removes those
              notices. This is not a safety or emergency service.
            </p>
            <p className="small muted">
              Last check-in:{" "}
              {displayDate(preferences.checked_in_at, family.family.timezone)}
            </p>
          </fieldset>
          <fieldset>
            <legend>
              <Sparkles size={17} /> Personal details, ready for review
            </legend>
            <label className="check-label">
              <input
                type="checkbox"
                name="insights"
                defaultChecked={Boolean(preferences.auto_insights)}
                disabled={
                  !family.family.cloud_consent ||
                  (family.member.role !== "primary" && !family.member.can_view)
                }
              />
              Automatically suggest details from newly approved memories
            </label>
            <p className="small muted">
              Nemotron on Nebius receives approved captions and tagged family
              names. Suggestions need primary-user approval before appearing in
              What matters.{" "}
              {family.family.cloud_consent
                ? ""
                : "Family AI permission must be enabled first."}
            </p>
          </fieldset>
          <button className="button primary" disabled={busy}>
            <Check size={17} />
            Save connection choices
          </button>
          {saved && (
            <p className="success-note" role="status">
              Your connection choices are saved.
            </p>
          )}
        </form>
      </section>
      {state.jobs.length > 0 && (
        <section className="settings-section">
          <h2>Personal detail preparation</h2>
          <ul className="extraction-jobs">
            {state.jobs.map((job) => (
              <li key={job.id}>
                <div>
                  <strong>
                    {family.memories.find((m) => m.id === job.source_id)
                      ?.title ?? "Family memory"}
                  </strong>
                  <small>
                    {job.status}
                    {job.model ? ` · ${job.model}` : ""}
                  </small>
                  {job.error && <p className="error-text">{job.error}</p>}
                </div>
                {["queued", "running"].includes(job.status) ? (
                  <button
                    className="button quiet"
                    disabled={busy}
                    onClick={() =>
                      run({ action: "extraction-cancel", id: job.id })
                    }
                  >
                    Cancel
                  </button>
                ) : (
                  ["failed", "cancelled"].includes(job.status) && (
                    <button
                      className="button secondary"
                      disabled={busy || !family.family.cloud_consent}
                      onClick={() =>
                        run({ action: "extract", sourceId: job.source_id })
                      }
                    >
                      Retry
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
