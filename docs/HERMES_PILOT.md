# Togetherly: Hermes Call-Preparation Pilot

Hermes adds a tool-using, reusable call routine to the existing Togetherly app.
It does not replace the family vault, authentication, approval system, or worker.
The pilot uses the actual [NousResearch Hermes Agent](https://github.com/NousResearch/hermes-agent)
library with NVIDIA Nemotron through Nebius Token Factory.

## Setup

Tested on Linux/WSL with Node 22.19 and Python 3.14. Install `uv`, then:

```bash
bash scripts/hermes/setup.sh
```

The setup pins Hermes to `9b904dcc22c23fe8b82834339bbdd96495072e59` and uses
its frozen `uv.lock`, including the upstream dependency overrides. Do not replace
this with an unpinned pip installation. Runtime files remain in ignored `.runtime/`.
The script refuses to replace a different existing checkout.

Add these settings to the existing `.env.local`, keeping private keys private:

```dotenv
TOGETHERLY_HERMES_ENABLED=true
AI_PROVIDER=token-factory
NEBIUS_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B
```

Set `NEBIUS_API_KEY` separately. Restart **both** Next.js and the worker;
`npm run dev` starts both. The library must be installed on the worker's host.
`TOGETHERLY_HERMES_PYTHON` can select a different absolute interpreter path.
Disabling the flag stops Hermes rituals, not existing direct-Nemotron features.
Runtime availability checks installation/configuration, not provider health.

## Try It End to End

1. Open a sample family or sign in. Under **My choices**, explicitly enable family AI.
2. Ensure a relative has an active account/profile and an approved, readable memory
   with a caption. The relative must have contributed it or be tagged in it.
3. Open **Family calls -> Connection rituals**, or `/rituals`, then **New ritual**.
4. Choose the relative, **Before our call**, **Hermes + NVIDIA Nemotron**, and
   the memories to use. Choose a schedule and permission expiry. Optionally enable
   **Offer a reply for my approval**. Save.
5. Under **Make this routine yours**, request: "Two memories, one question,
   simple language, newer contributions first." Select **Suggest changes**.
6. Inspect the current/proposed preferences, then **Approve routine**. Approval
   changes only the bounded preferences, never access, recipients, or sending rights.
7. Select **Prepare now**. Return later or reload; the durable worker continues.
   Inspect the generated captions, questions, **Original words**, and **Preparation record**.
8. Edit the proposed reply. Select **Review reply**, then **Approve and send**.
   Switch to the relative's sample account and verify the message in **Messages**.
9. Edit/delete a source or revoke permission. Its prepared content becomes unavailable.
   Already approved and delivered messages are not recalled.

Real Nano-backed runs have taken roughly one to four minutes per job locally,
including slow Python startup on the Windows-mounted WSL filesystem.
Learning and preparation are separate jobs; this is a background workflow, not
instant live-call assistance. A failed run is shown as a failure, never relabeled
as a successful Hermes result from another engine.

## Execution and Memory

```text
Authenticated UI -> existing /api/companion -> SQLite ritual + leased job
Background worker -> ephemeral Hermes AIAgent -> NVIDIA Nemotron / Nebius
Hermes tool requests -> private stdin/stdout bridge -> host permission checks
Validated preparation -> private review -> explicit approval -> Togetherly inbox
```

This is a **native Hermes tool-registry adapter**, not MCP or a Hermes chat gateway.
The runtime enforces the saved skill's read-before-prepare tool order rather than
letting the model submit a preparation before reading sources. The tested Nemotron 3
Nano preset disables extended thinking for these small structured tool requests;
the model still selects memories, writes captions/questions, and proposes preferences.
Every subprocess receives a fresh temporary profile and only the Nebius credential.
Hermes's generic memory, skill-writing, context-file loading, background review,
session database, tool discovery, and trajectory logging are disabled. Persistent
memory and preferences stay in Togetherly's permission-aware SQLite tables.

The tool allowlist for preparation is:

- `load_call_skill`: approved length, question count, focus, tone, and language.
- `get_approved_updates`: only selected approved captions and relevant family labels.
- `get_recent_preparations`: still-current earlier questions, when available.
- `prepare_connection`: submit a bounded, evidence-linked proposal; never send it.

Learning exposes only `load_call_skill` and `propose_skill`. Family memory captions
are not sent during learning. Reusable skills are declarative, versioned settings,
not self-written executable code. Source correction and family revision changes
conservatively invalidate preparations, so earlier questions are not permanent history.

Each tool and final commit rechecks the live job lease and permissions. The host
also checks once per second and kills the subprocess on revocation/cancellation.
Runs have a 240-second process deadline, a 300-second lease, bounded output/tool
calls, and at most three attempts for transient failures. Private temporary profiles
are removed after completion, errors, cancellation, or timeout. A hard host crash
can still leave a temporary directory for operator cleanup.

Schedules support manual preparation, every 24 hours, every 7 days, or 15 minutes
before a scheduled family call. They require the worker to remain running. Newly
added memories are not silently included: edit the ritual's selection explicitly.
The earlier general call-briefing feature remains independent of these rituals.

## Privacy Boundaries

- No automatic sending, email, WhatsApp, microphone monitoring, browser, terminal,
  file-management, arbitrary skill installation, or relationship/medical diagnosis.
- Tool schemas, exact quotes, selected source IDs, output sizes, and allowed actions
  are checked in application code. Quotes do not prove paraphrases semantically true;
  generated language still needs review. English first-person caption mistakes are
  rejected, but this is not a comprehensive factuality or multilingual safety test.
- Before delivery, the recipient must be allowed to read **every consulted memory**,
  not only the memories the model cites. A private preparation is not permission to share.
- This is **not OpenShell, NemoClaw, or an OS-level sandbox**. The Python dependency
  runs with the worker account's OS privileges; deploy under a least-privileged account
  and add process/network isolation before exposing a production service.
- Approved text reaches Nebius. Existing server-side media encryption is not
  end-to-end encryption, and SQLite text remains plaintext at rest. See README limits.

## Verification

```bash
npm test -- --hookTimeout 30000
npm run typecheck
npm run build
AI_PROVIDER=token-factory npm run test:hermes:live
TOGETHERLY_HERMES_BROWSER_LIVE=true ANUBANDH_TEST_URL=http://127.0.0.1:3002 \
  npm run test:e2e -- tests/browser/rituals.spec.ts --grep 'live Hermes' \
  --output test-results/hermes-live
```

Both live checks use synthetic families and make billable inference calls. The
script uses an in-memory database; the browser test needs a running live-mode test
server and worker with separate database, storage, build directory, and port.
For example, in a separate terminal:

```bash
AI_PROVIDER=token-factory TOGETHERLY_HERMES_ENABLED=true \
  ANUBANDH_DATABASE_PATH=/tmp/togetherly-live-demo/family.db \
  ANUBANDH_STORAGE_PATH=/tmp/togetherly-live-demo \
  ANUBANDH_BUILD_DIR=.data/hermes-live-build PORT=3002 npm run dev
```

Use a fresh test directory for repeated suites. Do not use `ANUBANDH_MEDIA_DIR`:
the supported setting is `ANUBANDH_STORAGE_PATH`, which isolates both media and keys.
Custom databases without an explicit storage path now fail closed, and cleanup
never deletes files just because the current database does not recognize them.
Warm development routes first on slow WSL filesystems. Use distinct Playwright
output directories when running suites concurrently to avoid deleting each other's traces.

Focused tests cover ownership, consent, source privacy, expiry/deletion,
viewer-relative labels, learning approval, tool allowlists, malformed outputs,
subprocess cleanup, scheduling, lease recovery, persistence, and duplicate delivery.
Browser tests include responsive layouts and a real learn/approve/prepare/send scenario.

### Handoff: 2026-10-26

Testing was stopped at the user's request. The final live browser scenario was
interrupted; it has not passed end to end. The isolated test server and worker
were stopped, and the normal app was not restarted.

- Last full offline run: 135 passed, 13 optional live tests skipped. A subsequent
  recipient-name regression passed in focused tests; the full suite was not rerun.
- Non-live browser scenarios, lint, TypeScript, and a production build passed
  during implementation. The build preceded the final recipient-name guard.
- A synthetic CLI run with actual Hermes/Nemotron completed learning, preparation,
  approved delivery, duplicate prevention, and source-deletion invalidation.
- Next: finish the live browser flow, review generated wording and mobile images,
  then rerun the full suite and production build. Keep test storage isolated.
- Media recovery remains unresolved: 13 uploaded-file records point to missing
  files, including six non-sample uploads (four photos and two recordings).
  See `.data/HERMES_TESTING_INCIDENT.md`. Do not overwrite the main database or keys.
