# Anubandh: Personal AI Hackathon Build Plan

Date: October 16, 2026. This is the original pivot proposal and scope rationale.
The five-part MVP is now implemented. See [implementation notes](ANUBANDH_IMPLEMENTATION.md)
for shipped behavior, verification, and limitations; not every proposal below is included.
The original OpenLoop data is preserved separately.

## 1. Product and Scope

**Anubandh is a private, user-controlled family-connection assistant that helps
people experiencing early cognitive difficulties prepare for conversations,
revisit meaningful memories, and reply to the people they care about.**

Build for an adult who wants communication support and can participate in choices
about their information, with optional help from a trusted person. Do not require
a diagnosis or store disease labels to use the product. A diagnosis must not be
treated as a reason to remove the user's agency.

The hackathon promise is one complete family interaction:

> A relative contributes an update. The primary user chooses what to retain.
> Anubandh prepares a simple, source-backed call brief. The user records and
> approves a reply, which reaches the relative's private inbox.

The product is not a diagnostic tool, cognitive assessment, disease monitor,
treatment, emergency service, or substitute for family contact. Benefits to
confidence or participation are intended outcomes to investigate, not established
clinical claims.

## 2. Differentiation

- **Before and after a real conversation:** prepare the person for a family call
  and help them follow through with their own reply.
- **Family-verified context:** preserve who contributed each detail and what the
  user approved. Retrieval is not permission to invent a biography.
- **Support without testing:** no scores, streaks, recall exams, comparisons over
  time, or embarrassing prompts such as "You should remember this."
- **Agency first:** relatives can contribute without automatically receiving
  access to everything. Supporters do not silently become account owners.

Do not claim the concept is globally unique or guaranteed to win. The competitive
case is a specific audience, coherent interaction, visible control, and a working
system rather than a generic memory chatbot.

## 3. MVP: Five Connected Capabilities

| Capability | What to build | Acceptance condition |
| --- | --- | --- |
| Family Memory Vault | Photos, text stories, family updates, voice recordings with author-supplied text captions, and human-confirmed people/relationships. | Upload -> review -> approve; persist across sessions; inspect original media and contributor; no automatic face identification. |
| Today in My Family | One to three short approved updates, a familiar image, and original family audio where available. | Every personal claim links to permitted source revisions; repeat or dismiss freely; no content fabricated when there are no updates. |
| Prepare My Family Call | A scheduled relative's chosen name/photo, confirmed relationship, recent updates, and two optional conversation starters. | Generated before an in-app scheduled call; shows only facts the user may access; missing names/relationships are not guessed. |
| Record and Approve a Reply | Record, replay, discard/re-record, choose recipient, and explicitly send to the authenticated family inbox. | The recipient receives exactly the approved recording once; delivery and opening are distinct; microphone denial has a text alternative. |
| Memory and Privacy Controls | Invite relatives, scope contribution/view/scheduling permissions, review changes, set expiry, correct/delete memories, and export. | Revocation and deletion affect media access, derived briefs, jobs, and future model context, not just the visible list. |

MVP language scope: English plus one preferred family language, provisionally Hindi.
Human review must cover that language, proper names, kinship terms, and dates.
Release a single-language flow first if the second language cannot be verified.

## 4. Demonstration Family Journey

Use synthetic people and licensed or consented images; do not ask real families to
upload sensitive material into an unfinished prototype.

1. Meera, an invited daughter, uploads a photograph. She manually tags the people
   and supplies a caption with known facts, such as the occasion and approximate
   date. Unknown details remain unknown.
2. Meera records a short family update and supplies a text caption for AI use.
   Her contribution is pending, not automatically part of long-term memory.
3. Asha, the primary user, previews the contribution and approves it. A specifically
   delegated reviewer may help only within a visible, revocable grant.
4. A scheduled worker prepares the next family briefing and a call brief from
   approved sources. The browser need not be open.
5. Asha opens Today and sees an accessible update. Before the scheduled call she
   can open "About Meera" and optional topics without being asked to recall facts.
6. Asha records a reply, listens back, and confirms "Send to Meera." Meera receives
   it in her private Anubandh inbox. Nothing is sent through WhatsApp or email.
7. A correction to a source regenerates affected briefs. Deleting a source makes
   its derived content unavailable; revoking Meera's grant blocks future access.

The app does not know who is currently calling through other applications. In the
MVP, "Prepare my call" refers to an explicitly scheduled, confirmed contact. An
optional user-entered call link opens the existing calling app; we do not build
video calling, capture the call, or listen in the background.

## 5. Experience and Accessibility

### Primary User Experience

Tablet-first responsive interface, also usable on phones and desktops. The first
screen is the useful experience, not a marketing landing page.

- Today: one prominent family update, original voice playback, and next scheduled
  call. Keep content short and let the user choose when to advance.
- My Family: familiar, approved photographs and plain relationship labels.
- Memories: a simple photo/story viewer with contributor and date information.
- Reply: a focused recording screen with visible recipient, replay, and send.
- My Choices: accessible permission and retention decisions, with more detailed
  administration available separately.

### Family Contribution Experience

Invited relatives have an upload/update form, review status for their contributions,
the call schedule they may edit, and their own inbox. A family role is enforced by
the server, not a visual role switch that exposes the primary user's workspace.

### Design Principles

Use [W3C cognitive-accessibility guidance](https://www.w3.org/TR/coga-usable/) as
a design reference: familiar controls, clear language, consistent navigation,
recoverable errors, and interactions that do not depend on remembering previous
steps. This guidance is not a clinical validation or accessibility certification.

The [Alzheimer's Association communication guidance](https://www.alz.org/help-support/caregiving/daily-care/communications)
emphasizes speaking directly to the person, not assuming inability, allowing time,
and offering help when requested. Needs vary, and early cognitive impairment is
not synonymous with Alzheimer's disease.

- Adult, respectful visual design: white/light-neutral surfaces, charcoal text,
  teal actions, and restrained coral/blue accents. Real family media supplies the
  emotional connection; no hospital dashboard or infantilizing game aesthetic.
- Start with 20px body text, spacious line height, adjustable text size, 48px or
  larger touch targets, and strong contrast. Verify 200% zoom and narrow screens.
- Use familiar Lucide icons with short text labels for important actions. Photos
  supplement names; they never replace all text. Cards, where needed, stay at 8px
  radius or less; page sections are not nested cards.
- One main action and one question per step. Stable button placement, visible
  Home/Back, clear recording state, and no gesture-only controls.
- No auto-advancing photo carousels, unexpected audio, time-limited quizzes, or
  disruptive pop-ups. Pause/replay and reduced motion are supported.
- Keep repeat requests neutral. Do not track repetition as disease progression,
  reveal "failure counts" to relatives, or optimize for engagement streaks.
- Provide a maintained accessible authentication flow, such as passkeys with a
  secure recovery alternative. Do not use family-history questions as passwords.
  Accessible recovery must not turn every family invitation into account access.

## 6. AI Responsibilities and Boundaries

Use NVIDIA Nemotron through Nebius Token Factory for:

- Proposing structured facts from a contributed text caption for review.
- Simplifying and translating approved updates without changing their meaning.
- Selecting relevant approved memories for a particular scheduled family call.
- Producing short, optional conversation prompts grounded in that context.

Reuse the existing provider interface and Zod validation. Begin with the current
configured model, `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, after rechecking account
availability. Existing OpenLoop smoke tests do not establish quality for this new
audience or language task. Run new held-out tests before selecting models or
claiming reliability. Do not assume JSON mode, vision, transcription, or speech
generation capabilities that have not been verified.

For this MVP, photographs and voice recordings are displayed/played as media;
Nemotron receives approved text captions and structured relationships, not raw
images or audio. Manual tags establish depicted identities. There is no facial
recognition, voice identification, or automatic emotion inference.

### Grounded Generation

1. Authenticate the requester and retrieve only approved sources within the
   current family, user permissions, purpose, and validity period.
2. Assemble a small context package of approved facts, source IDs/revisions,
   relationship labels, and the selected language/reading preferences.
3. Require structured output with short statements and supporting source IDs.
   Treat source text as data, never permission to call tools or alter access.
4. Validate schema, source references, scope, names, dates, and relationship fields.
   An attributed quote does not establish that a contributor's statement is true.
5. For personal facts, favor approved fields and bounded paraphrases. If validation
   fails, show the approved caption/template or a clear unavailable state. Do not
   fill gaps with a plausible family story.
6. Record model, input revisions, purpose, job time, and validation result without
   copying private content into operational logs.

Never infer an unrecorded relationship, deceased/living status, memory, emotion,
diagnosis, or outcome. Conflicting family accounts remain attributed and unresolved
until reviewed; the model does not choose the "true" account based on confidence.
Let the user hide a topic or skip an activity. Do not automatically surface
potentially distressing anniversaries or manufacture comforting false memories.

Repeated generation must not change core personal facts. Use a context-revision
cache and invalidate it on source correction, permission change, or expiry.

### Audio

Use browser `MediaRecorder` for original voice messages with capability detection,
format/duration/size limits, replay, and a text alternative. Recording starts only
after explicit interaction and microphone permission; it is never always-on.

No speech-to-text is required for the first end-to-end demo. Contributors provide
the accompanying text used by Nemotron. Do not pretend an unverified caption is a
verbatim transcript; label it as contributor-supplied text.

Read-aloud for generated briefs is optional after a supported voice path is
verified. Browser speech services may send text to another provider; do not label
them local/private without verification. Disclose any additional processor and
obtain consent. Original family audio remains available without synthetic TTS.
Do not clone a relative's voice or impersonate them.

## 7. Permissions and Privacy

Define distinct grants: contribute, view selected memories, review contributions,
schedule calls, and receive messages. The primary user controls grants; a supporter
has only explicitly delegated capabilities. Each grant has scope, purpose,
expiry, and a revision. Invitations expire and are single-use.

Contributions are pending by default. A user may explicitly delegate review within
a narrow scope; family membership alone does not approve storage or cloud use.
Keep pending media separate from approved assistant memory and give it a disclosed
retention period. A denied contribution never appears in a generated briefing.

Before sending a reply, bind approval to the recording content hash/revision,
recipient IDs, and current access. Retries must not deliver duplicate messages.
Distinguish "saved privately," "available in Meera's inbox," and "opened"; none
means the recipient understood it or accepted a responsibility.

Private media must not live in Next.js `public/`. Authenticate and authorize every
image/audio request, including playback range requests. Store media outside the
public web root or in private object storage. Validate file types and sizes, strip
unneeded metadata from normalized images, escape captions, and reject unsupported
active formats. Do not permit arbitrary remote media fetching.

For hosted use require HTTPS, secure sessions, server-side family/item checks,
encrypted storage/backups with documented key access, upload/request quotas, and
secret isolation. The existing SQLite prototype is not encrypted and has no auth;
it must not be presented as a ready-made secure Family Memory Vault.

Cloud inference is not end-to-end encrypted from the provider: Nebius processes
the selected plaintext context. Explain that boundary and verify current provider
retention terms before using real family data. Do not promise zero retention.

Keep explicit provenance links from every generated artifact to its source
revisions. Correction, expiry, or deletion invalidates dependent briefs, indexes,
queued work, and cached audio if any. Recheck grants before dispatch, commit, and
artifact reads. Revocation cannot recall information already processed or heard.

Explain backup deletion windows and storage limits honestly; row deletion is not
forensic erasure. Audit records should retain minimal metadata, not deleted
personal text. Exports and previously downloaded copies cannot be remotely erased.

Use synthetic demo data until security gates pass. For real user research, obtain
accessible, voluntary consent and appropriate supporter/domain-professional
involvement. Do not make clinical capacity assessments in software or assume a
relative has legal authority to consent for another adult. Photos/voices of other
people also require appropriate permission.

## 8. Technical Architecture and Reuse

```text
Primary-user UI                Invited-relative UI
       |                               |
       +------- Authenticated Next.js server -------+
                         |                          |
                Typed domain services       Private media service
                         |
             SQLite/Drizzle + durable jobs
                         |
                 Supervised Node worker
                         |
           Permission-filtered approved text
                         |
          NVIDIA Nemotron on Nebius Token Factory
                         |
           Validated briefing / call preparation
```

Keep Next.js/React/TypeScript, Drizzle/SQLite, Zod, Lucide, and the existing Nebius
adapter. Add a maintained auth library compatible with the installed framework,
private media storage, and a worker. No graph database, vector database, generic
multi-agent framework, or Redis is necessary for a small single-host prototype.

New domain records: users, families, memberships/grants, people/relationships,
contributions, approved facts, media assets, scheduled calls, skill definitions,
generated artifacts and their provenance, messages, jobs, and minimal receipts.
Use revisions, foreign keys, scoped indexes, and tracked migrations.

Reuse concepts and selected code, not the old commitment schema unchanged:

| Existing OpenLoop capability | Anubandh use |
| --- | --- |
| Provider and structured-output validation | New family-update, briefing, and call-preparation schemas. |
| Source-linked memory review | Contribution/fact review with family and item permissions. |
| Approval and receipt patterns | Approve exact voice reply/recipient and record delivery. |
| Deletion and stale-output checks | Broaden to media, source revisions, artifacts, caches, and jobs. |
| SQLite and tests | New domain migrations and isolated family fixtures. |

Start a separate Anubandh database through `DATABASE_PATH`, with a different
private media directory. Preserve the existing OpenLoop database and documents;
never silently reinterpret or delete its records. There is no family-data migration
to perform from project commitments. Keep `.env.local` private and unchanged until
the implementation deliberately configures the new runtime.

### Always-On Operation

The worker watches persisted schedules and approved contribution events. It can
prepare a morning briefing and a call brief at user-selected times while the UI is
closed. It does not continuously listen, watch the camera, or collect device data.

Skill specifications define required inputs, source scopes, output schemas,
approval policy, and retention. Ship runnable `family_daily_brief`,
`prepare_family_call`, and a deterministic `deliver_approved_reply` workflow.
The model cannot execute delivery or change permissions.

Use durable job leases, bounded retries, deduplication keys, and atomic result
commits. Network inference occurs outside database transactions. Respect timezone,
DST, quiet hours, and cancellations. Show truthful last-generated times and worker
health in the family/admin view without burdening the primary screen.

Deploy web and worker on one persistent host with a local disk, restarts, backups,
and TLS. Token Factory supplies the required Nebius integration. Nebius AI Cloud
hosting is optional. Ephemeral serverless filesystems are unsuitable for this
SQLite/media design; serverless adoption would require durable external storage.

## 9. Track Alignment

The [official Personal AI track](https://nebiusglobalaihackathon.devpost.com/)
requires an always-on, private assistant with persistent memory, reusable skills,
chosen tools/information, and daily workflows, using at least one NVIDIA
open-source model on Nebius Token Factory or Nebius AI Cloud.

| Track capability | What judges can verify |
| --- | --- |
| Persistent memory | Approve a family update, restart, then use it in a call brief. |
| Always-on assistance | A worker prepares the scheduled brief with both browsers closed. |
| Reusable skills | Run briefing and call preparation for different approved relatives. |
| Chosen tools/data | Revoke one family member or source scope and show enforcement. |
| Completed workflow | Record, approve, and deliver a real message to the relative's in-app inbox. |
| NVIDIA/Nebius usage | Real inference receipts, model identifier, schemas, and architecture. |
| Design and impact | An accessible human-connection flow and honestly reported usability observations. |

NemoClaw, OpenShell, Hermes Agent, and Nebius Serverless are examples in the track
description, not a requirement to use every tool. Avoid adding infrastructure
solely for a logo or making unsupported clinical claims to strengthen the pitch.

## 10. Build Order and Release Gates

Target the published October 30, 2026, 17:00 UTC deadline, with a feature freeze
before submission. Recheck the official rules and eligibility. Dates below assume
focused development and necessary deployment/auth credentials are available.

| Dates | Batch | Exit gate |
| --- | --- | --- |
| Oct 16-18 | New family domain, isolated database, auth/roles/grants, synthetic family, accessible shell. | Two separate accounts cannot cross family/item boundaries; old data remains intact. |
| Oct 19-21 | Private photo/audio upload, manual tags/captions, contribution approval, source reader, basic deletion. | Only approved, permitted facts enter retrieval; media access is authenticated. |
| Oct 22-24 | Nemotron briefs/call preparation, durable worker, language checks and progress/error states. | A source-backed brief is prepared with browser closed; unknown details remain unknown. |
| Oct 25-26 | Record/preview/send, private recipient inbox, exact-revision approval, correction/expiry propagation. | One approved recording reaches only the intended recipient, including after retry/restart. |
| Oct 27-29 | Held-out tests, accessibility/usability checks, hosted hardening, demo, repository and submission. | Complete workflow, source revocation, and browser/mobile tests pass; limitations are documented. |

Do not expose private family data on a public URL before authentication, media
authorization, isolation, and storage protections pass. A public demo must use a
separate synthetic deployment; shared visitor role-switching must never exist in
the real family workspace. A reproducible authenticated test build is preferable
to an insecure open demo.

### Verification

- Grounding tests: unknown relative, ambiguous name, conflicting caption, changed
  relationship, unrelated photo, missing date, malicious instructions, permission
  expiry during generation, deletion after caching, and empty family history.
- Language tests: names, kinship terms, tense, dates, short sentences, no invented
  facts, and preservation of the contributor's meaning. Include human review.
- Security tests: guessed IDs, cross-family access, expired invite, revoked media
  access, direct downloads/range requests, unauthorized scheduling, forged send
  approval, and secrets/private content in logs.
- Reliability tests: duplicate job/event, crash and restart, late model result,
  recording upload failure, unsupported codec, microphone denial, message retry,
  two-tab edits, source correction, and scheduled timezone changes.
- Browser tests: Playwright screenshots at phone/tablet/desktop sizes; 200% zoom,
  text overflow, visible focus, keyboard/screen-reader names, touch targets,
  reduced motion, photo loading, real audio recording/playback, and no autoplay.
- Usability: invite a small number of caregivers and, where appropriate and
  supported consent is available, primary users. Observe task completion,
  assistance needed, misunderstanding of sharing, and confidence in controls.
  Stop sessions on discomfort; do not perform memory testing.
- Report model errors, approval/delivery correctness, latency, and usability
  observations. Do not report improvements in cognition or disease outcomes.

Existing OpenLoop tests are not Anubandh acceptance tests. Run typecheck, lint,
unit/integration tests, production build, and synthetic live-model checks during
implementation. No new application tests or billable inference ran for this plan.

## 11. Three-Minute Demo

| Time | Show |
| --- | --- |
| 0:00-0:20 | Introduce the family-connection problem and show the primary user's simple Today screen. |
| 0:20-0:50 | Daughter contributes photo, manual tags, original voice update, and text caption; user approves. |
| 0:50-1:15 | Real Nemotron processing and a scheduled worker receipt; show that memory persists across sessions. |
| 1:15-1:50 | The source-backed family update and call brief; replay original audio and choose a conversation topic. |
| 1:50-2:20 | User records, replays, and approves a reply; switch to the authorized daughter's inbox and play it. |
| 2:20-2:45 | Correct/delete a source or revoke a grant; show affected brief/media access changing. |
| 2:45-3:00 | Model/Nebius receipt, architecture, and responsible non-clinical positioning. |

Label any time compression or fixtures. Use live model calls for the AI workflow,
not a hardcoded result presented as inference. Prepare the scheduled-call test in
advance without claiming to detect an actual incoming phone call.

Submit a working URL or test build, public repository with MIT license and setup
instructions, public YouTube video of three minutes or less, track selection,
description, NVIDIA/Nebius integration details, technology feedback, and an honest
account of the OpenLoop-to-Anubandh changes made during the submission period.

## 12. Deferred Features and Pitch

After the MVP: a single opt-in photo-story activity, user-requested word/phrase
suggestions, verified read-aloud/transcription, additional languages, and approved
external calendar/message integration. Word-finding suggestions must be optional
choices, not declarations of what the user meant.

Defer live call coaching, automatic caller/face recognition, cloned voices,
clinical caregiver summaries, disease-progression analytics, medication advice,
scored memory games, autonomous outbound messages, and a broad music catalog.
Use only licensed or user-authorized media for future activities.

**Submission pitch:**

> Anubandh helps people experiencing early cognitive difficulties stay involved
> in family conversations. Using NVIDIA Nemotron on Nebius Token Factory, it
> turns approved family updates and memories into simple briefings and call
> preparation, then helps the person send their own voice reply. Every memory has
> a source, every family member has limited access, and the user stays in control.

First implementation batch: create the new family domain and consent model,
isolated synthetic workspace, authenticated roles, and primary-user/contributor
screens. Read the installed Next.js documentation before framework edits, as
required by `AGENTS.md`. This plan does not itself rename the app, move databases,
connect accounts, deploy services, or change the dashboard.
