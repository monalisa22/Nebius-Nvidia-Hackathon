# OpenLoop V2: Personal Follow-Through

Planning date: October 15, 2026. Status: proposed implementation, not shipped.

## 1. Product Decision

Keep OpenLoop and its conditional-memory core. Build a personal assistant for
independent builders and professionals juggling several projects:

> Remember what I promised, notice when things change, and help me pick up the
> right next action. Ask before acting on my behalf.

The central experience is **Today**, not a chatbot or a wall of operational
metrics. The differentiator is a **return-to-work brief**: what changed while I
was away, which commitments that affects, and the next useful action, with
inspectable evidence.

Combine three ideas from the original shortlist without building three products:

- OpenLoop: conditional commitments and follow-through.
- ThreadBack: a source-backed project checkpoint and resume brief.
- ContextLease: explicit, revocable permission for background work.

Example: "When issue #42 closes, prepare my client update using this project's
notes. Let me review it." The user returns to an evidence-linked update and an
editable draft, not another reminder to investigate the issue themselves.

This is a differentiated direction, not a claim of market uniqueness or a
prediction of winning. Demonstrated usefulness and reliability matter more than
adding the largest feature list.

## 2. Research and Hackathon Alignment

### Lessons From Previous Submissions

Reviewed the completed [Agentic AI Unleashed: AWS & NVIDIA Hackathon](https://nvidia-aws.devpost.com/)
and its [project gallery](https://nvidia-aws.devpost.com/project-gallery).
The following awards appear on the individual Devpost pages. Capabilities below
are their authors' descriptions, not independently verified runtime results.

| Submission | Observed award and approach | Adaptation for OpenLoop |
| --- | --- | --- |
| [Nomi](https://devpost.com/software/nomi-aoim58) | Grand Prize. Sensor events become caregiver summaries and alerts, with an explicitly defined audience. | Quiet monitoring, understandable changes, and attention only when needed. Do not copy medical features or claims. |
| [Skyrchitect](https://devpost.com/software/skyrchitect-6d37yf) | Second Place. Domain tools and retrieved context produce architecture plans, infrastructure code, and estimated costs. | End workflows with useful artifacts: editable follow-ups, briefings, and checklists. Show provenance and measured usage. |
| [Agent Builder](https://devpost.com/software/agent-builder) | Third Place. Natural-language workflow generation, visual editing, and step-by-step testing. | Turn a request into a small, inspectable skill specification with explicit tools and approval points. Avoid a general node-canvas builder. |

Important caveats: Nomi discloses sample frontend data and a deployment-permission
workaround. Skyrchitect lists actual deployment execution as future work. Agent
Builder describes both dummy and live modes. We should clearly distinguish live,
fixture, and planned behavior, rather than repeat broad production-ready claims.

### Current Nebius Requirements

Checked the [official overview](https://nebiusglobalaihackathon.devpost.com/)
and [resources](https://nebiusglobalaihackathon.devpost.com/resources) on October 15.
The published deadline is **October 30, 2026, 10:00 PDT / 17:00 UTC**. Recheck the
[official rules](https://nebiusglobalaihackathon.devpost.com/rules) for participant
eligibility and submission conditions before submitting.

| Requirement | Implementation evidence |
| --- | --- |
| NVIDIA open-source model on Nebius Token Factory or AI Cloud | Live Nemotron extraction, evidence interpretation, and artifact generation through Token Factory; model receipts. |
| Always-on private assistant | A supervised worker processes selected sources while the browser is closed; visible health and last successful check. |
| Persistent memory | Approved memories, project checkpoints, source references, and corrections persist across sessions and restarts. |
| Reusable skills | Runnable follow-up and briefing skills, versioned configuration, run history, bounded tool access. |
| User-chosen tools and information | Project/source-scoped grants, expiry, revocation, cloud-context preview, read-only connector. |
| Daily workflow execution | Capture -> approve -> monitor -> prepare artifact -> review -> save/export. Completion of the original commitment remains explicit. |
| Coherent design and credible impact | Personal Today and project views; test with people juggling real work threads and report observed results. |

NemoClaw, OpenShell, Hermes Agent, and Nebius Serverless are named as possible
tools, not a requirement to adopt all of them. Do not import the previous AWS
event's SageMaker/EKS requirements into this project.

The resource page offers $25 Token Factory credits using
`NEBIUS-DEVPOST-GLOBAL26` and another $25 through the Builders Program, subject to
their eligibility and activation terms. Credit activation remains an account
owner action; it is not part of application implementation.

## 3. Existing Foundation and Gaps

Keep the existing Next.js, TypeScript, SQLite/Drizzle, Zod, Lucide, and
OpenAI-compatible provider stack. Already implemented: consent-gated live
extraction, editable candidate review, exact source quotes, persistent
commitments, evidence evaluation, approved local draft saves, deletion handling,
model receipts, and explicit live/fixture modes.

Specific issues to address first:

| Current code | Gap | Planned correction |
| --- | --- | --- |
| `lib/repository.ts:476` | Saving a follow-up transitions the commitment to completed, although the actual deliverable may remain unfinished. | Separate commitment lifecycle, trigger readiness, and artifact execution. |
| `lib/repository.ts:325` | Evaluates every active project commitment sequentially using only the new evidence. | Route relevant evidence to affected loops and include bounded supporting history. |
| `lib/repository.ts:348` | Every evaluation updates state and deletes pending drafts, even if it confirms existing evidence or is unrelated. | Add no-change handling; invalidate only artifacts whose supporting context materially changed. |
| `lib/repository.ts:195` | No durable import identity, deduplication, or extraction recovery workflow. | Persist an import/job record; retry the same operation without duplicate memories. |
| `lib/repository.ts:136` | Dashboard reads unbounded collections and repeatedly searches arrays. | Page-specific, indexed, paginated queries and explicit source joins. |
| `lib/db.ts` and `lib/schema.ts` | Raw initialization SQL duplicates the schema without tracked migrations. | Introduce versioned migrations with tested legacy-data upgrade. |
| `app/page.tsx` | One long page mixes capture, administration, review, and daily work. | Real routes, focused screens, and progressive disclosure. |
| `README.md` | Correctly notes manual monitoring and missing authentication. | Worker and secure deployment are release requirements, not cosmetic additions. |

Long model requests currently run inside interactive actions. Prior testing
included a draft request exceeding 60 seconds. Background jobs must preserve work
and communicate progress even when inference is slow or unavailable.

## 4. Feature Priorities

### P0: Reliable, Complete Personal Assistant

| Feature | Acceptance criteria |
| --- | --- |
| Correct loop lifecycle | Draft saving never completes the underlying promise. Explicit complete, reopen, archive, and snooze actions have receipts. |
| Durable processing | Import/evaluation/drafting returns a job identifier promptly; progress, retry, failure, and cancellation survive refresh. A worker restart does not lose or duplicate the visible result. |
| Personal Today | Show changes since the last acknowledged visit, up to three user-relevant next actions, waiting items, and the latest briefing. Each item opens its evidence or draft. |
| Quick capture and review inbox | Capture text from any screen; review/edit extraction; distinguish no candidates from extraction failure; support a user-authored memory when extraction missed something. |
| One real connector | Poll only user-selected GitHub issue/PR resources. Show connection status, permission scope, freshness, rate limits, and disconnect. No repository writes. |
| Permission grants | Background access is opt-in, scoped to project/sources/purpose/tools and expiry. Revocation blocks new dispatch and rejects stale results. |
| Runnable skills | Follow-up and daily briefing execute with typed inputs/outputs, versioned settings, approval policy, and run receipts. |
| Draft workspace | Edit, regenerate, approve the exact revision, save locally, and download Markdown. Material evidence changes mark an unsaved draft stale without silently losing edits. |
| Memory control | Inspect sources, search approved memories, correct a record, preview deletion impact, export, and configure expiry. No unexplained cross-project context sharing. |
| Secure, reproducible release | Protect private data before network exposure; provision durable storage and restartable web/worker services; document a clean install independent of `/tmp`. |

### P1: Signature Features for the Submission

1. **What changed while I was away?** Group changes by consequence: ready now,
   still waiting, or needs clarification. Explain which source changed the
   interpretation. Acknowledge updates without changing task completion.
2. **Resume a project.** Save an explicit checkpoint containing objective, verified
   facts, decisions, assumptions, blocker, and next step. On return, compare it
   with newer approved evidence. Flag stale assumptions; do not invent what the
   user was thinking or monitor their screen.
3. **Personal briefing preferences.** Name, timezone, working days, briefing time,
   quiet hours, and preferred draft style. Scheduled briefings use approved
   context and have citations; no new evidence means no repeated model call.
4. **Editable skill presets.** Duplicate an existing follow-up/checklist preset,
   edit its output format and allowed inputs, test it, then approve a version.
   Natural-language skill suggestions are optional and cannot add permissions.

### P2: Only After the Core Demo Is Stable

- Calendar integration and calendar exports.
- Semantic memory search if keyword/project/date search proves insufficient.
- User-uploaded project covers and additional appearance themes.
- Voice capture, with separate transcription consent.
- Multi-condition triggers beyond a small, explicitly supported typed set.

Defer Gmail/Slack breadth, autonomous sending, arbitrary code execution, a general
multi-agent framework, personality inference, a knowledge-graph canvas, and
mobile-native apps. These add risk or breadth without strengthening the core demo.

## 5. UI and Interaction Plan

### Visual Direction

A quiet personal workspace, with the clarity of a well-made notebook and the
efficiency of a task app. White/light-neutral backgrounds, charcoal text, teal
primary actions, blue informational accents, and amber/coral attention states.
Color is not the only status signal. Avoid an all-purple, all-beige, or dark-slate
dashboard, decorative charts, large hero sections, and nested cards.

Use restrained 24-28px page headings and 14-16px body text, fixed type sizes,
zero letter spacing, visible focus states, and 4-8px corner radii. Unframed page
sections and compact divided lists should carry most content; individual repeated
items and genuinely framed editors can use cards.

Use existing Lucide icons, tooltips and accessible names; segmented controls for
views, switches for binary preferences, swatches for accents, and menus for
secondary actions. Add accessible dialog/menu primitives only where needed.
Use actual profile/project imagery when available and permitted, with a neutral
fallback. Do not send uploaded imagery to a model or add stock hero photography.

Motion should communicate state changes, respect reduced-motion settings, and
never resize rows or move a button while the user is interacting. Avoid in-app
marketing, explanatory feature blocks, and excessive AI branding.

### Screens

| Route | Primary experience |
| --- | --- |
| `/` Today | Small personal greeting/date, latest brief, changes, next actions, waiting items, and a project-resume entry. No top-level KPI wall. |
| `/inbox` | Candidate memories and ambiguous evidence; source preview next to review controls; select/edit/approve/reject. |
| `/loops` | Searchable list with Ready, Waiting, Review, and Completed views; project filter; due dates; snooze and explicit completion. |
| `/projects/[id]` | Project objective, checkpoint/resume brief, related loops, sources, and saved artifacts. |
| `/memory` | Approved memories and a sources tab, search/filter, source reader, corrections, expiry and deletion controls. |
| `/skills` | Small list of runnable skills; editable configuration and run history. Reachable from secondary navigation. |
| `/settings` | Personal preferences, sources/permissions, worker health, AI usage, privacy, and export. |

Desktop: compact sidebar, focused content column, optional right-hand evidence
drawer. Mobile: Today/Inbox/Loops/Memory navigation, remaining destinations in an
accessible menu, and full-screen detail views. Capture and search remain easy to
reach; there are no dead placeholder controls.

Every screen needs empty, populated, loading, validation-error, retry, stale-data,
permission-expired, and disconnected states where relevant. Preserve in-progress
form edits through recoverable server errors.

## 6. Reliability and Architecture

### State and Evidence

- Separate loop lifecycle (`open`, `completed`, `revoked`, `archived`) from
  readiness (`waiting`, `ready`, `needs_review`), `snoozedUntil`, and artifact state.
  Revoking evidence is not the same as cancelling the user's commitment.
- Give editable entities explicit integer revisions. Approval binds the artifact
  revision, supporting-context fingerprint, skill version, and permission version.
- Distinguish unrelated evidence, confirming evidence, contradictory evidence,
  and insufficient evidence. Unrelated/duplicate events cannot clear readiness or
  destroy a valid draft. Material contradictions invalidate approval and require
  reevaluation. Readiness changes cannot silently reopen a completed commitment.
- Record source identity, provider resource/version, event time, ingestion time,
  and provenance. Pasted claims about an actor are not authenticated statements.
- For GitHub, let Nemotron propose a typed trigger such as `issue.state == closed`
  or `pull_request.merged == true`; the user approves the exact repository/resource
  binding. Evaluate these facts deterministically from authenticated API data.
  Closing an issue is not proof of deployment or completion of a different task.
- Use model interpretation for free-text conditions; uncertain identity,
  conflicting evidence, or unsupported predicates require review. An exact quote
  proves provenance, not truth or authorization.
- Treat imported content as untrusted data, not tool instructions. Model outputs
  pass schema, citation, workspace, and permission checks before state changes.

### Durable Worker

Keep SQLite for the single-host hackathon deployment. Add a durable jobs table
with kind, owner/workspace, deduplication key, entity references and revisions,
status, next attempt, attempt count, lease expiry, cancellation, and redacted error.
Avoid duplicating full private notes into job payloads and logs.

Run a dedicated supervised Node worker, separate from Next.js request handlers.
Claim jobs atomically with short transactions, bounded concurrency, lease renewal,
and crash recovery. Never hold a SQLite transaction open across a network call.
Use WAL, busy timeouts, indexes, and an idempotent transactional result commit.

Delivery is at least once, not magically exactly once: duplicate provider calls
after a crash may still cost credits. Deduplicate committed artifacts/receipts and
make this limitation explicit. Retry transient timeouts/429/5xx with bounded
backoff; require correction for validation, authorization, or invalid-input errors.

Check permissions and revisions both before dispatch and before commit. Cancelled
or revoked in-flight results must not become visible artifacts. Revocation cannot
recall context already sent to Nebius; disclose that boundary.

Schedule connector polls and briefings server-side using persisted next-run times.
Respect timezone/DST with a maintained scheduling/date library. Coalesce missed
briefings after downtime and avoid bursts of duplicate notifications. Browser
polling is for displaying progress, never for keeping the agent alive.

### Connector Boundary

Start with GitHub selected issues and pull requests using its structured API and
a least-privilege, read-only token stored server-side. For the hackathon demo, use
a dedicated repository containing only synthetic project data. Never modify
someone's real repository to demonstrate the workflow without permission.

Poll at a configurable, rate-limit-aware interval (initial target: 60-120 seconds).
Use stable resource IDs, version timestamps/ETags where available, pagination,
deduplication, and current-state reconciliation. A missed transient event during
downtime must not be presented as a continuously true current condition. Do not
claim actor-specific history when an endpoint does not provide that evidence.

Private repository access requires the owner's explicit token/scope setup.
Unrestricted URL fetching, webhook deployment, and additional connectors are not
needed for the first version. Polling must stop when the grant expires or access
is revoked; UI freshness must reflect failures rather than show a false green state.

### Data, Privacy, and Deployment

- Add projects, workspace ownership, jobs, grants, connector cursors, skill runs,
  artifact revisions, checkpoints, and derived-source references through versioned
  migrations. Expand existing tables only where necessary.
- Back up the existing database using SQLite's consistent backup mechanism before
  migration. Preserve notes, evidence, IDs, and user edits. Test legacy upgrades
  on a temporary copy. Never use demo reset as a migration.
- Historical `completed` rows may mean only "draft saved." Preserve that history
  and flag ambiguous completion for review; do not silently invent actual delivery.
- Start search with SQLite FTS5 and explicit project/date/status filters. Exclude
  pending/rejected memories from assistant retrieval. Apply permission filtering
  before constructing the cloud context, not after generation.
- Track derived sources for briefings, checkpoints, search indexes, drafts, and
  queued jobs. Deletion/expiry removes dependent content or marks remaining claims
  unverified. Tombstones prevent deleted connector content from reappearing unless
  the user explicitly reimports it. Audit receipts must not retain deleted text.
- Keep expiry opt-in for existing data. Show impact before deletion and distinguish
  source retention from permission duration. Explain WAL, backup, and provider-log
  limits; do not claim forensic erasure or end-to-end encryption.
- Before public hosting, use maintained Next.js-compatible authentication with
  GitHub sign-in, an owner allowlist, secure HttpOnly sessions, and server-side
  ownership checks for every query, mutation, job, and download. Verify library
  compatibility during implementation instead of hand-rolling auth.
- Run any public synthetic demo in a separate deployment/database with no access
  to personal notes or private connector credentials. Interactive demo writes need
  isolated visitor workspaces, quotas, rate limits, and expiry. If that isolation is
  not ready, offer an authenticated demo plus a reproducible test build instead.
- Deploy web and worker on one persistent Linux host with a local disk volume,
  HTTPS, process restart policies, backups, and separate liveness/readiness checks.
  Token Factory already provides the required Nebius model integration; hosting
  this on Nebius AI Cloud is an optional deployment choice, not a reason to move
  SQLite onto ephemeral serverless storage.
- Do not share a SQLite file across machines/network storage. Move to PostgreSQL
  and a suitable job backend only if multi-host deployment actually becomes needed.
- Pin a supported Node runtime and lockfile-based dependencies, provide reproducible
  startup/health commands, and remove reliance on disappearing `/tmp` installations.
  Leave the existing secret in ignored `.env.local`; never put it in the plan,
  examples, browser bundles, logs, screenshots, or public repository.

### Model Strategy

Keep `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` as the initial default. It already
supports the implemented workflow. Re-query the actual account catalog and run
held-out comparisons before adding routing to Super or another model.

Previous checks are useful but limited: Nano passed a final 13-case synthetic run
after prompt changes; Super's full evaluator timed out; Lightning timed out; Ultra
was listed but was not benchmarked. These are not proof of production reliability
or that every available NVIDIA model has been tested.

Measure latency, retries, token usage, and model name per job. Cache only against
permission-aware input revisions. Use deterministic filtering for routine source
checks; use Nemotron where language understanding and synthesis add value. Apply
per-workspace budget limits. Display estimated cost only with a dated, verified
price source. Never silently substitute fixtures when live inference fails.

## 7. Implementation Order and Verification

The schedule assumes one focused developer and timely access to deployment and
GitHub credentials. It is a target, not a delivery guarantee. Keep each phase
independently runnable and testable; prioritize P0 over additional integrations.

| Dates | Work | Exit check |
| --- | --- | --- |
| Oct 15-17 | Regression tests, migrations, separated state, revisions, deduplication and source relevance. | Existing data survives upgrade; saving a draft cannot complete a promise; duplicate/unrelated evidence preserves valid work. |
| Oct 18-20 | New UI shell, Today/Inbox/Loops, source drawer, quick capture, editable drafts. | Complete manual capture-to-save flow works on desktop and mobile with real persisted data. |
| Oct 21-23 | Durable worker, scoped grants, read-only GitHub connector, runnable briefing. | Browser closed and worker restarted: one real source change still yields one traceable result. |
| Oct 24-25 | Resume checkpoint/brief, preferences, memory search/expiry, skill presets. | Resume brief accurately separates known facts from stale assumptions and links every important claim. |
| Oct 26-27 | Authentication, hosted setup, privacy boundary tests, held-out model evaluation, accessibility. | No cross-workspace access; clean deployment/restart; scoped live end-to-end test passes. |
| Oct 28-29 | Freeze features, user walkthroughs, fix failures, record demo, finish repository and submission. | Working URL/test build, README/license, public video, model/service explanation and feedback ready. |
| Oct 30 | Submission buffer before 17:00 UTC. | Recheck links and submit; no last-minute platform rewrite. |

Ownership/schema boundaries start in phase one even though hosted authentication
lands later. The app remains localhost-only until the public-release gate passes.
If time slips, drop P2 and natural-language skill generation first. Keep the
conditional trigger, real worker, permissions, Today, and evidence-backed demo.

### Test Gates

- Unit/domain: transitions, no-change evidence, approval revisions, snooze,
  completion, grants, expiry, and timezone/DST behavior.
- Repository/migration: legacy upgrade, transactional writes, concurrent edits,
  deduplication, pagination, source deletion and all derived records.
- Worker: crash before/after result commit, expired lease, duplicate/out-of-order
  events, timeout/429, revocation during inference, and cancel/retry behavior.
- Security: forged IDs, cross-workspace reads/writes/downloads, untrusted note
  instructions, unsupported tools, expired grants, and secrets in errors/logs.
- Model: a held-out corpus distinct from prompt-tuning examples; target at least
  30 varied notes and 60 evidence cases including negation, wrong actor/project,
  revoked conditions, ambiguity, and irrelevant text. Report extraction precision/
  recall and trigger confusion counts; require no false-ready outcomes on the
  designated critical safety cases before release. Publish misses honestly.
- Browser: Playwright at 390px, 768px, and 1440px; keyboard-only navigation,
  focus return/trapping, contrast, long names/text, reduced motion, broken/missing
  images, screenshot review, and no horizontal overflow or overlapping controls.
- End-to-end: live Nemotron + authentic GitHub state -> worker -> brief/draft ->
  exact-revision approval. Repeat with a changed condition and source deletion.
- Usability: target three short walkthroughs with builders juggling projects;
  measure time to find the next action and complete the workflow, and record
  confusion points. Treat time-saved claims as unproven until measured.

Run typecheck, lint, offline tests, and a production build after each substantial
phase. Live tests are explicitly billable and must use synthetic data, not private
workspace notes. No tests were newly run for this planning-only document.

## 8. Three-Minute Demo and Submission

Use one consistent project story with real model calls and an authentic GitHub
resource. Prepare the connector grant and demo repository before recording.

| Time | Demonstration |
| --- | --- |
| 0:00-0:20 | Show Today and the actual note: "When issue #42 closes, prepare my client update." Establish the forgotten follow-through problem. |
| 0:20-0:50 | Nemotron extracts a candidate; user reviews the quote, repository/resource binding, and allowed skill, then approves. |
| 0:50-1:15 | Show the narrow monitoring grant. Close the app and close the synthetic issue on GitHub; the independent worker continues. |
| 1:15-1:50 | Return to the changed-since-last-visit brief, current source evidence, and prepared draft. Show real poll/job timestamps; label any time compression. |
| 1:50-2:20 | Edit and approve the exact draft, save/export, and show that the underlying commitment is still open. |
| 2:20-2:45 | Reopen the issue or revoke permission; show changed readiness or stopped access and invalidated pending approval, as appropriate. |
| 2:45-3:00 | Show the relevant receipt, NVIDIA model/Nebius usage, persistent memory, and source control. |

Keep the resume checkpoint as an additional interactive demo path if it does not
fit naturally into the three-minute recording. Do not hide inference failures or
present fixture behavior as live autonomy.

Submission checklist: working URL or test build; public repository; MIT license
visible; clear setup and limitations; public YouTube video no longer than three
minutes; Personal AI track selection; project description; NVIDIA/Nebius usage;
technology feedback; and a dated explanation of significant hackathon-period
updates if applicable.

## 9. First Implementation Batch

Start with regression tests for draft-save completion and irrelevant-evidence
handling, then introduce the smallest necessary migration/revision changes. Build
the new navigation and Today screen against those corrected contracts before
expanding automation. Read the installed Next.js guides in
`node_modules/next/dist/docs/` before changing framework code, as required by
`AGENTS.md`.

This document adds a plan only. It does not change application behavior, restart
the dashboard, activate cloud credits, connect accounts, or deploy services.
