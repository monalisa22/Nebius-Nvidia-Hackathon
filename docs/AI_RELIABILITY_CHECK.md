# Family AI Reliability Check

Checked on October 27, 2026.

## Fixes

- Direct Nano requests now disable extended thinking, matching the existing
  Hermes preset. Before the fix, a synthetic brief returned HTTP 200 but exhausted
  all 4,096 output tokens without returning a reporting function.
- Whitespace-only changes in quoted evidence are resolved back to the exact
  original excerpt before persistence. Changed words, punctuation, case, invented
  evidence, untagged people, and unauthorized actions remain rejected.
- Detail extraction receives the contributor's identity, so first-person updates
  can be distinguished from other tagged people. Untagged memories skip inference.
- Job errors preserve actionable validation, access, and quota messages. The SDK
  no longer adds retries on top of worker retries. HTTP 429 stops the job for
  manual quota review; transient connection/server failures retain bounded retries.

## Verification

Five live requests used only an in-memory synthetic family and a synthetic guitar
story. No real family memories, photos, or recordings were sent by the diagnostic.
The baseline consumed 4,096 output tokens without a tool result. With thinking
disabled, requests returned structured results in 142-253 output tokens.
Extraction passed validation and persistence live. Brief/catch-up responses exposed
flattened paragraph breaks; replay tests then verified those responses through the
formatting fix, strict validation, persistence, and approval-gated reply delivery.

The offline suite passed 157 tests; 13 opt-in live benchmark cases were skipped to
conserve quota. Coverage includes wrong/invented quotes, whitespace restoration,
contributor attribution, revoked consent, quota/authentication failures, truncation,
source invalidation, and approval requirements. Type checking and linting of
changed code also passed. Four browser tests passed against a separate fixture-only
app and vault: viewer-relative relationships, captions/evidence/starters,
ritual preparation and mobile layouts, and access boundaries. The live Hermes
browser test was intentionally skipped. The temporary app and worker were stopped.

This is a targeted regression check, not a claim that all future model outputs
will validate. Unsupported output remains a visible failure rather than fabricated
or hardcoded personal content.

## Optional Live Check

Each invocation makes at most one HTTP request, uses synthetic data only, and
closes its in-memory database afterward. It does not start a worker or read the
family vault. It requires the existing server-side Nebius configuration.

```bash
node --import tsx scripts/check-family-ai.ts --live --task=extract
node --import tsx scripts/check-family-ai.ts --live --task=brief
node --import tsx scripts/check-family-ai.ts --live --task=ritual
```

Restart both the application and its worker after updating the code. Existing
failed jobs retain their historical messages; generate a fresh preparation or
request fresh suggestions to use the fixes.
