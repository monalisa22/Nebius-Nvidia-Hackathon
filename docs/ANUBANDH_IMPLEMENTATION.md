# Togetherly Implementation

Togetherly was previously named Anubandh. Internal paths, environment variables,
and storage identifiers retain the legacy name for compatibility.

Implemented October 16, 2026. The five-part MVP replaces the old project dashboard
while keeping its database and source files separate.

## First Walkthrough

1. Open localhost and choose **Open a sample family**.
2. In **My choices**, switch to the fictional daughter Meera.
3. Add a story or photo with a caption. It appears under Contributions as pending.
4. Switch back to Asha and approve it in **Manage memories -> Review memories**.
   Inspect/correct it before approval if needed. People tags can also be corrected, and **Your people**
   has profile/relationship correction controls available to the primary user.
5. Select **Prepare my briefing** and read the cloud permission prompt. This
   sends approved text, not raw images/audio. Separately permitted photo analysis
   can add reviewed visual evidence; see [photo understanding](PHOTO_UNDERSTANDING.md).
6. The separate worker prepares the brief. Click its source references to inspect
   the original captions. Repeat in **Family calls** for a selected call.
7. Record a reply in **Messages**, listen back, and save the private draft.
8. Approve delivery to Meera. Switch to her sample account and open the message.
9. Correct or delete a source. Related briefs disappear. Change a relative's
   permissions to demonstrate server-side revocation.

Sample families are isolated. The account-switch control is available only in
synthetic workspaces. Use separate browser profiles/accounts for a real family.

## Simplified Memory Experience

Your day and Memories now include photo-led collections: Little moments, Through
the lens, Stories to revisit, and Familiar voices when recordings are available.
The viewer preserves original captions and contributor attribution, provides
manual previous/next controls and keyboard navigation, and links to the original
source or a private reply. It does not auto-advance or autoplay recordings.

Collections contain only approved, unexpired sources from the permission-filtered
snapshot. Removing a currently viewed source replaces it with an unavailable state
on the next refresh, rather than silently substituting a different memory. Photo
loading and errors have explicit feedback and a retry control.

The primary navigation is Your day, Memories, Your people, and Messages, with
bottom navigation on phones. Calls and privacy remain accessible; contribution
and review tools are grouped under Manage memories. These are display collections,
not AI-generated event histories or Google Photos/Gmail integrations.

UI verification: 57 offline tests passed; five non-live browser workflows passed
(the live-model test was intentionally skipped for this UI change). TypeScript
and lint passed. Mobile/desktop screenshots cover the viewer and 320/390/768/1440px
layouts, including the larger-text control.

## Architecture

- `lib/anubandh/store.ts`: independent SQLite family domain, tracked initial schema,
  item permissions, invites, sessions, message lifecycle, job leases and provenance.
- `lib/anubandh/ai.ts`: forced reporting function, Zod validation, exact source
  checks, English excerpts and separately labeled Hindi translations.
- `lib/anubandh/media.ts`: safe image decoding/normalization, audio format checks,
  private encrypted files, authenticated playback, orphan cleanup.
- `lib/anubandh/auth.ts`: iron-session cookies, server-side revocable sessions.
- `scripts/anubandh-worker.ts`: independent durable scheduler/processor, no device
  monitoring. `scripts/dev.sh` starts it together with the dashboard.
- `app/api/*`: authenticated account, family, media, and export endpoints.
- `app/ui/*`: primary-user and relative views, review forms and voice workflow.

Model selection supplies meaningful language work: deciding which approved updates
are relevant to the call and selecting concise source excerpts. Identity, access,
delivery approval, and job completion are enforced in code. The model cannot
execute a send or modify grants.

## Testing and Limits

Unit tests cover approval, cross-family access, single-use invitations, expired
grants, revocation, duplicate jobs/messages, same-day scheduling, stale outputs, quotation grounding,
expiry, source deletion, worker lease recovery, and sample isolation.

Browser tests cover contribution/review across accounts, synthetic microphone
recording, private delivery/audio range playback, responsive screenshots, keyboard
dialogs, direct-media authorization, real account invitations, profile corrections,
session revocation, cancellation during microphone acquisition, and opt-in live
Nemotron inference. The microphone is synthetic; tests never record a real person.

Verified on October 16, 2026:

- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- `npm test -- --hookTimeout 30000`: 53 passed; 13 opt-in legacy live tests skipped.
- `ANUBANDH_LIVE_TEST=1 npm run test:e2e`: all five browser workflows passed.
- Inspected screenshots at 320, 390, 768, and 1440 pixels; no horizontal overflow,
  including the narrow-screen larger-text check.
- Live English Nemotron output matched approved fictional source excerpts. The
  live browser test disables its sample family's AI consent after verification.
- Health endpoint reports the Token Factory configuration and connected worker.

These checks are engineering verification, not clinical or Hindi-language quality
validation. Test artifacts remain local under ignored `test-results/`.

This is an implemented hackathon MVP, not a clinically validated or production-
certified assistive product. Memory Garden, live word finding, transcription,
external messaging, stronger account recovery, and a public hardened deployment
remain outside this release. See README for precise privacy and deployment limits.
