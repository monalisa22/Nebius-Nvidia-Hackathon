# Togetherly

Because relationships deserve remembering.

A personal family-connection assistant for the Nebius x NVIDIA Personal AI track.
Togetherly turns approved family captions and updates into source-linked briefings
and call preparation, then helps a person record and approve their own reply.
It supports communication, not diagnosis, treatment, or cognitive assessment.

## Run

Node.js 22.19+ is recommended.

```bash
npm ci
cp -n .env.example .env.local
npm run dev
```

Do not overwrite an existing `.env.local`. The existing Nebius key stays there.
In this workspace, `bash scripts/dev.sh` also finds the pinned Linux Node runtime
under `.runtime/`. The start script runs both Next.js and the background worker.
Open **http://127.0.0.1:3000**. Set `PORT=3001` if port 3000 is occupied.

Choose **Open a sample family** for a separate fictional workspace, or create a
real account and invite relatives. Sample accounts can be switched under
**My choices -> Sample family accounts**. Real accounts have no role-switch control.
Use synthetic data until your deployment and consent practices are reviewed.

## Implemented

- Primary-user and invited-relative accounts with password hashing, encrypted
  HttpOnly session cookies, server-side session revocation, and one-use invites.
- Separate family/item permissions for viewing, contributing, and scheduling.
- Private photo/voice uploads, manual people tags, caption review, approval,
  correction, sharing choices, expiry, and deletion.
- Today, family profiles, memory search/gallery, review inbox, and scheduled calls.
- Live NVIDIA Nemotron on Nebius Token Factory for short, viewer-aware captions
  and personal conversation starters in English or Hindi, with exact original
  excerpts kept as evidence. Reviewed personal facts remain exact excerpts.
- Viewer-relative family labels, such as daughter for a parent and sister for a
  sibling, computed from entered relationships and explicit family links, not AI.
- Persistent scheduled jobs, bounded retries, stale-result checks, source receipts,
  daily briefings, and call preparation 30 minutes before the scheduled call.
- Record/replay/discard original audio; private drafts; explicit approval; actual
  delivery to the recipient's in-app inbox; separate delivered/opened states.
- AES-256-GCM encryption for uploaded media, authenticated media playback/range
  requests, image normalization/metadata stripping, and upload/storage quotas.
- Responsive views, keyboard dialogs, text sizing, optional on-device read-aloud,
  and an authenticated JSON export of accessible captions and messages.
- Photo-led memory collections with a manual previous/next viewer, original
  captions, source inspection, and direct replies. Simplified navigation and
  phone bottom tabs keep everyday actions separate from memory administration.
- Separately permitted Nemotron vision analysis for selected photos, with
  family-reviewed observations, story questions, themed collections, and named
  memory walks. Original stories and manual details are preserved; reviewed
  photo evidence can enrich briefings and call routines.
- A personal album-style home with family portrait filters, source-caption
  previews, Surprise me, and a touch-scrollable memory shelf. Gentle animations
  respect reduced motion; management lives in an on-demand drawer.

The original OpenLoop database is untouched. New records default to
`.data/anubandh/family.db`; media and local keys live beside it. Do not delete the
keys while retaining encrypted media: recordings/photos cannot then be recovered.

## Configuration

### Relationship Companion

An additive backend milestone is available at `/api/companion`: source-linked
fact review and Nemotron extraction, confirmed event dates and daily moments,
private connection activity, explicit family links, activity invitations,
scheduled message capsules, saved memory walks, call-context sessions, and
opt-in check-in notices. Connected screens now live under Your day, People,
Memories, Messages, and My choices. Automatic suggestions and check-ins remain
off by default. The existing worker processes approved scheduled actions.

See [the feature walkthrough](docs/COMPANION_WALKTHROUGH.md),
[the product and UI plan](docs/RELATIONSHIP_COMPANION_PLAN.md), and
[the API contract](docs/COMPANION_API.md). Transcription, live call listening,
and external delivery require later integrations.

### Optional Hermes Call Routines

The focused `/rituals` view adds private, source-selected connection routines.
Hermes can learn bounded call preferences from a request, propose them for review,
then use the approved routine to prepare short captions, conversation questions,
and an optional reply. Sending still requires separate approval. Daily, weekly,
and pre-call schedules run through the existing durable worker.

Install with `npm run hermes:setup`, enable `TOGETHERLY_HERMES_ENABLED=true`, and
restart the app and worker. Uses actual Hermes Agent and NVIDIA Nemotron on Nebius;
no MCP or OpenShell integration is claimed. See [setup, controls, and the complete
walkthrough](docs/HERMES_PILOT.md). The direct-Nemotron option remains available.

### Environment

```dotenv
AI_PROVIDER=token-factory
NEBIUS_API_KEY=your-private-key
NEBIUS_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B
NEBIUS_VISION_MODEL=nvidia/Nemotron-3.5-Super-VL
TOGETHERLY_PHOTO_DAILY_LIMIT=10
ANUBANDH_DATABASE_PATH=.data/anubandh/family.db
ANUBANDH_STORAGE_PATH=.data/anubandh
```

`AI_PROVIDER=fixture` selects an explicitly labeled offline excerpt workflow.
There is no silent fixture fallback when Nebius fails. Hindi translation requires
live inference. Recordings are not sent to the model; contributors supply captions.
Photos are sent only for an explicitly selected analysis with separate photo
permission. Reviewed photo details can then accompany captions in text workflows.
See [photo understanding and its walkthrough](docs/PHOTO_UNDERSTANDING.md).
Generated captions retain expandable original words
and source links. Summaries are AI paraphrases, not independently verified facts.
Refresh an existing briefing or prepare a call again to replace older excerpt-only
results. Offline fixtures do not fabricate personalized summaries or starters.
For a separate local test instance, `ANUBANDH_BUILD_DIR=.data/test-build` isolates
Next.js build output; also set separate `ANUBANDH_DATABASE_PATH`,
`ANUBANDH_STORAGE_PATH`, and `PORT` values to keep test data out of the family vault.
The photo collections group existing approved, unexpired memories; they do not
infer events or dates from images, auto-advance, or connect to Google Photos/Gmail.

The primary user must explicitly enable AI processing. This permits scheduled
processing of approved text until revoked. Approval to process text never authorizes
sending a message. No camera or microphone is monitored in the background.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
ANUBANDH_LIVE_TEST=1 npm run test:e2e
RUN_LIVE_COMPANION=1 npm run test:e2e -- tests/browser/companion-ui.spec.ts
```

Run the web server and worker before browser tests. The last two commands opt into
billable inference on newly created fictional family captions. It never selects
a real family's data. Tests use a synthetic microphone device, not your microphone.
Linux browser testing may need `npx playwright install-deps chromium`. The test
configuration also detects the locally provisioned `.runtime/browser-libs`.

The legacy OpenLoop tests remain. Slow cold imports on a Windows-mounted WSL
filesystem can need `npm test -- --hookTimeout 30000`.
Browser screenshots and traces are written under ignored `test-results/`.
For repeated browser runs, use fresh `ANUBANDH_DATABASE_PATH` and
`ANUBANDH_STORAGE_PATH` locations for the test server, with `PORT=3001` and
`ANUBANDH_TEST_URL=http://127.0.0.1:3001` for Playwright. Stop the normal dev server
first because both use the same Next build directory. This avoids consuming
the normal workspace's sample-family quota. `WATCHPACK_POLLING=2000` can help
development file watching on Windows-mounted WSL workspaces.

## Production and Privacy Limits

Build with `npm run build`, then run `npm start` and `npm run worker` as separate
supervised processes on one host with persistent local storage. Production cookies
require HTTPS. Use a TLS reverse proxy, encrypted disk/backups, protected key storage,
and deployment-level request size/rate limits. An optional 32+ character
`ANUBANDH_SESSION_SECRET` can replace the generated local session key.

Important boundaries:

- The server holds media encryption keys. This is not end-to-end encryption.
  SQLite captions, profiles, and metadata are not database-level encrypted.
- Nebius can read approved text and separately permitted selected photos it
  processes. Verify provider retention terms before using real family content.
  On-device read-aloud refuses nonlocal voices.
- Deletion removes application records, encrypted media, and dependent briefs.
  It cannot recall downloads, information already heard, backups, or provider logs.
- The family roster and relationship labels are shared within an invited family;
  memory viewing is separately scoped. Invitations do not establish legal authority.
- This MVP does not offer password recovery/email verification, passkeys, speech
  transcription, face recognition, voice cloning, embedded video calls, external
  messaging, clinical monitoring, or validated therapeutic activities.
- A prepared call is a scheduled event, not detection of an incoming call. Replies
  go to an authenticated Togetherly inbox, not WhatsApp, SMS, or email.
- JSON export contains accessible records, not a ZIP archive of media binaries.
- No clinical efficacy or accessibility certification is claimed. Involve intended
  users in appropriately consented usability testing before real-world deployment.

Keep the current development server on localhost. The public hackathon repository
should contain no `.env.local`, family databases, keys, private media, or test traces.
A hosted public demo should be a separate synthetic-data deployment.

## Project Notes

- [UI design system](docs/DESIGN_SYSTEM.md)
- [Hackathon build plan](docs/ANUBANDH_HACKATHON_PLAN.md)
- [Demo and implementation notes](docs/ANUBANDH_IMPLEMENTATION.md)
- [Photo understanding, privacy, and demo steps](docs/PHOTO_UNDERSTANDING.md)
- [Earlier model observations](docs/MODEL_SELECTION.md), not a family-support benchmark
- [Original OpenLoop plan](IMPLEMENTATION_PLAN.md), retained as project history

Sample photography comes from Unsplash and represents fictional characters, not
identified people. See [asset attribution](public/demo/ATTRIBUTION.md).
License: MIT.
