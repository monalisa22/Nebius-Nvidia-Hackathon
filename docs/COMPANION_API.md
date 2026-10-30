# Relationship companion backend

This milestone provides backend workflows. The existing UI does not yet expose
these new commands. See `RELATIONSHIP_COMPANION_PLAN.md` for the screen sequence.

## Read

`GET /api/companion` returns the current member's preferences, daily memory,
connection activity, permitted facts and source metadata, explicit family links,
their activity invitations, their capsules and walks, check-in notices, companion
sessions, and extraction jobs. A relative cannot read someone else's private
drafts, check-in settings, activity invitations, or private message history.

`GET /api/companion?personId=<uuid>` returns that person's approved context and
conversation prompts. Refresh it during a user-started companion session. It
does not record, transcribe, or integrate with a video call.

Both routes use the existing session cookie and return `private, no-store`.

## Commands

POST JSON to `/api/companion` with the existing authenticated session. Same-origin
checks, rate limits, Zod validation, and fresh member permissions apply. The exact
typed request schemas are in `lib/togetherly/contracts.ts`.

| Action | Required fields and behavior |
| --- | --- |
| `memory-context` | `sourceId`, `revision`, `occurredOn` (ISO date or null), `place`, `legacy`; primary user confirms details on an approved source |
| `fact-propose` | `sourceId`, `fact: {personId, category, quote}`; exact source quote, already-tagged person, pending review |
| `fact-review` | `id`, `decision: approved/rejected`; primary user only |
| `fact-delete` | `id`; primary user only |
| `extract` | `sourceId`; queues source-linked Nemotron suggestions with cloud consent |
| `extraction-cancel` | `id`; requesting member only |
| `link-add` | `fromId`, `toId`, `kind: parent/partner/sibling`; primary user only; parent is directed from parent to child |
| `link-delete` | `id`; primary user only |
| `connection-log` | `peerId`, `kind: call/visit`, `happenedAt` (past/current timestamp); records an explicitly reported interaction |
| `connection-delete` | `id`; reporting member only |
| `preferences` | `reminders`, `quietDays`, `checkinEnabled`, `trustedId`, `checkinDays`, optional `autoInsights`; changes only the signed-in member's settings |
| `check-in` | No additional fields; records an explicit check-in and clears prior notices |
| `notice-read` | `id`; recipient only |
| `activity-create` | `assigneeId`, `personId`, `promptKey`; a self-assignment starts accepted, another person receives an invitation |
| `activity-update` | `id`, `operation: accept/decline/cancel/complete`, `evidenceId` for completion; approved, personally contributed evidence must tag the subject |
| `capsule-create` | `recipientId`, `title`, `text` and/or `mediaId`, `deliverAt`; creates a private draft |
| `capsule-approve` | `id`, `revision`; explicitly approves scheduled inbox delivery |
| `capsule-cancel` | `id`, `revision`; stops delivery |
| `capsule-reschedule` | `id`, `revision`, `deliverAt`; returns to draft and requires fresh approval |
| `walk-create` | `title`, `sourceIds`; up to 30 approved sources in the chosen order |
| `walk-progress` | `id`, `position`, `status: active/paused/completed`; position is the item's original ordinal |
| `walk-delete` | `id`; owner only |
| `session-start` | `personId`; returns an owned session and current approved context |
| `session-end` | `id`; ends only the signed-in member's session; does not claim a call occurred |

Fact categories: `interest`, `milestone`, `birthday`, `stated_feeling`.
Activity prompt keys and their user-facing wording are returned in `activityPrompts`.

## Scheduling and consent

The existing worker processes capsules and check-in notices each cycle. When no
briefing job is ready, it processes an extraction job. All new automatic features
default off. `autoInsights` additionally requires existing family cloud consent.
It queues newly approved source revisions; failed jobs require a fresh explicit
`extract` request. Disabling automatic suggestions cancels the member's queued
and running suggestion jobs.

The worker never substitutes generated speech for a person's voice. A capsule
reuses one existing private message draft. It becomes visible to the recipient
only after its approved time and a fresh sender/recipient access check. No message
can bypass scheduling through the existing `reply-send` action. Use the existing
`reply-delete` action with the capsule's `message_id` to remove the capsule and its
recording. Cancelling preserves the private draft; deletion removes it.

Check-in notices are in-app only. Consent belongs to the person checking in.
The trusted recipient sees that an agreed check-in was not recorded, not an
assessment of the person's safety or wellbeing. Polling/reading does not update
the check-in time. Consent withdrawal or a new check-in removes notices.

## Source lifecycle

English facts are exact excerpts, not generated biographies. AI proposals require
primary review. Stated feelings must be explicit in the source and reviewed for
correct attribution. Dates are entered separately by the primary user; upload
dates are never used as historical event dates.

Source corrections invalidate facts. Read paths recheck approval, revision,
expiry, and audience. Deletion removes linked facts/metadata and walk items.
When a walk's current source is missing, `currentSourceId` becomes null; the UI
must offer a deliberate move to another available item instead of replacing it.
Completed activity history remains, but its removed evidence and milestone credit
are no longer exposed. Exports include the new accessible companion records.

## Later integrations

Automatic transcription, imported photos, embedded calling, live call listening,
and external delivery are not implemented in this milestone. The snapshot's
`capabilities` object reports those limits. Original audio and reviewed story text
continue through the existing voice-memory workflow.
