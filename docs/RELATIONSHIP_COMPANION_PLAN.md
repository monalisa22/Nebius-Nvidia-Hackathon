# Togetherly: Relationship Companion

## Product promise

Help someone know what is happening with their people, start a conversation,
make a memory together, and revisit it later. Success is a meaningful family
interaction, not time spent scrolling or a relationship score.

The existing tagline remains: Because relationships deserve remembering.

## Delivery order

Backend milestone implemented October 25, 2026. Verified with 21 companion
domain tests, 20 existing family tests, an authenticated HTTP integration flow,
TypeScript, and targeted lint. The frontend milestone is now connected through
separate memory, people, conversation, and capsule views, with a swipeable home.
Real Nemotron extraction was verified on a new fictional family: two exact-source
suggestions remained pending until human approval. Consent was disabled after
the test. The integration-specific features below remain separate work.

1. Backend: additive migrations, permission-checked APIs, durable workflows,
   source-linked AI suggestions, and regression coverage. This is the first
   implementation milestone; existing screens continue to work.
2. UI: connected journeys, loading, empty, review, expiry, and failure states;
   desktop/mobile layouts and keyboard navigation. See the
   [feature walkthrough](COMPANION_WALKTHROUGH.md).
3. Integrations: evaluate a speech provider for consented transcription, then
   optional photo imports and call integrations. Do not present these as working
   before the integrations exist.

## Feature decisions

| Suggestion | Implementation direction | Screen |
| --- | --- | --- |
| Relationship health | Private connection activity: recorded calls/visits and actual inbox messages; configurable reminders; no numerical relationship rating | People |
| Daily memory moment | Stable daily selection; anniversaries only from an explicitly supplied event date | Your day |
| Live conversation rescue | User-started companion session with approved context beside an existing call; live listening is a later integration | Calls |
| Story preservation | Original audio and reviewed text, people, place, and event date; AI proposes source-linked details; automatic transcription follows provider evaluation | Memories / Stories |
| Grandchild challenges | Optional invitations to family activities, accept/decline, approved memory as completion evidence, personal milestones | Memories / Make a memory |
| Relationship coaching | Gentle suggestions grounded in actual app interactions; user chooses whether to contact anyone | People |
| Living family tree | Explicit family links, editable by the primary user; profiles connect to permitted facts, stories, and events | People |
| Memory capsules | Private drafts with explicitly approved future delivery to an active family inbox, cancellation, and durable deduplication | Messages / For later |
| Emotion-aware updates | Only explicit, source-backed feelings, reviewed before display; no mood prediction from silence, faces, or writing style | People / What matters |
| Family circle | Connection facts visible to the person involved; no family-wide surveillance or red isolation labels | People |
| Memory walk | User-selected ordered approved sources, saved position, pause/resume, no autoplay or scored recall | Memories / Walks |
| What matters cards | Source-linked interests, milestones, birthdays, and stated feelings; AI suggestions require primary review | People |
| Bharosa | Opt-in missed-check-in notice to a selected trusted relative, based on explicit check-ins; withdrawal removes notices; no emergency or wellbeing inference | My choices / Check-ins |

## Backend contracts

The `/api/companion` endpoint provides a permission-filtered snapshot and validated
commands. It uses the existing authenticated session and same-origin checks.
Existing `/api/family` and media endpoints retain their contracts.

New records reference the existing family, member, person, memory, and message
tables. All source-derived information checks source approval, revision, expiry,
and current audience. New source revisions invalidate extracted facts.

AI jobs persist separately from existing briefing jobs. Nemotron extracts exact
quotes associated with already-tagged people and classifies their relevance.
It does not authorize access, infer dates for anniversaries, assign emotional
states, or deliver messages. Suggestions remain pending until reviewed.

Capsules use the existing encrypted-audio message pipeline. Delivery rechecks
sender and recipient access. Worker retries cannot produce duplicate messages.
Check-in consent is personal: even a primary family user cannot enable another
member's monitoring. No background polling counts as a human check-in.

## UI structure

- Your day: one daily memory, one optional invitation to connect, and upcoming
  conversations. Swiping moves between individual moments, not unrelated tools.
- People: familiar portraits, connection activity, explicit family links, and
  source-backed what-matters cards. One obvious action: start a conversation.
- Memories: browse, preserve a story, take a walk, or make a memory together;
  these are separate views with their own progress and navigation.
- Messages: received, drafts, sent, and future capsules. Sending always has a
  recipient and an explicit approval step.
- My choices: permissions, sources, language, reminders, and check-in consent.

Animations respond to actions, respect reduced motion, and never advance audio
or a memory walk without the person's choice. Activities have no public ranking,
streak penalties, or pressure to respond.

## Acceptance gates

Test cross-family access, stale member objects after revocation, restricted and
expired sources, exact quote validation, unapproved AI suggestions, real event
dates including leap days, future-content confidentiality, duplicate delivery,
withdrawn check-in consent, and worker interruption. Browser coverage exercises
source approval through conversation context, evidence-backed activity completion,
capsule privacy and cancellation, saved walks with deleted sources, and check-ins.

## Integration boundaries

Google imports, external video calls, passive call listening, automatic speech
transcription, and external push/SMS delivery need separate provider and consent
work. In-app activity never proves loneliness, illness, danger, or relationship
quality. Family information remains user-supplied and correctable.

## Verification: October 25, 2026

- Production build, TypeScript, and ESLint passed.
- 78 offline tests passed with `npm test -- --hookTimeout=30000`; 13 optional
  provider tests were skipped in that run.
- The full browser regression run passed 16 workflows; its two paid-provider
  tests were skipped. Desktop and mobile checks covered 320, 390, 768, and
  1440 pixel widths, including existing recording and access-control flows.
- Three final focused browser tests passed: source review, capsule controls,
  and a new concurrent-editor test. This covers 17 distinct non-live workflows.
- A separate live Nebius run verified
  `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`: two verbatim, source-linked suggestions,
  pending review, then human approval. Only newly created fictional data was
  used, and cloud consent was disabled afterwards.
- Final regression runs used temporary databases and media storage. On this
  Windows-mounted WSL workspace, restarting the dev server was necessary to
  discard stale compiled UI. Cold endpoint compilation also required a longer
  sample-creation request timeout; production throttles were not weakened.

Story metadata and capsule date editors retain the revision from when they
opened. Background refreshes cannot silently authorize an overwrite of another
session's changes. UI screenshots are under ignored `test-results/screenshots/`.
