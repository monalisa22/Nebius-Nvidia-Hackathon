# Photo Understanding

Togetherly can suggest visible details, a gentle story question, and collection
themes for a selected photograph. The family's original title, caption, people,
date, place, and Family Stories choice remain unchanged. A photo caption may be
empty; existing written stories still require text.

## Try It

1. Restart the app and worker with `bash scripts/dev.sh`. From Windows PowerShell:
   `wsl --cd /mnt/c/nebius bash scripts/dev.sh`. The usual address is
   `http://127.0.0.1:3000`; an explicit `PORT` overrides it.
2. Sign in as the primary family member. In **My choices**, enable family AI
   processing, then **Allow AI for photographs we choose**. Photo permission is
   separate and off by default.
3. In **Memories**, open an approved photo and choose **Explore this photo**.
   The primary member or that photo's contributing author can request analysis.
   No other photographs are automatically sent.
4. Review the description, visible details, question, and themes. Correct or
   dismiss them as needed, then choose **Keep reviewed details**. Only the primary
   family member can approve them. Your original story remains above them.
5. Back in **Memories**, use **Threads of our lives** to open a collection, swipe
   through photos, and create a named memory walk. Navigation buttons and arrow
   keys when the photo viewer is focused are also supported. Photos are ordered
   by family-confirmed event dates, with undated photos last.
6. Generate a fresh daily briefing, call preparation, or connection ritual.
   Reviewed photo descriptions and observations are now available alongside
   original captions. AI selects relevant evidence; a photo detail is not
   guaranteed to appear in every result. Photo-derived citations are labeled
   **Reviewed photo details**, distinct from original story quotes.
7. To verify privacy, turn off photo processing. Photo analyses and their derived
   evidence disappear; affected prepared outputs are invalidated. Original
   stories, photos, and their manual details remain. Existing memory walks retain
   their original memories, without the withdrawn photo suggestions.

For a family demonstration, start with one Diwali photo and its true short story.
Review the suggested decorations or activities, keep the Diwali theme, and repeat
with a second photo. Create a walk, then prepare a conversation with a family
member already tagged in those memories. The AI does not identify people from
faces or invent who was present.

## Implementation

- **Model:** `nvidia/Nemotron-3.5-Super-VL`, accessed server-side through Nebius
  Token Factory's OpenAI-compatible API. Existing text-model and Hermes paths
  remain in place. Images are not forwarded to Hermes; reviewed text evidence is.
- **Image preparation:** Sharp corrects orientation and resizes a temporary copy
  to at most 1024 x 1024 pixels, encoded as JPEG at quality 80 without metadata.
  The encrypted original is not modified. Only the selected image, its original
  caption, and the family's language preference enter the vision request.
- **Structured output:** A bounded JSON schema requires a short description,
  up to five observations, up to four themes, and one story question. Zod rejects
  malformed output. Truncated responses and model-requested tool calls fail
  closed. The vision call has no tools or authority to take actions.
- **Review and provenance:** Suggested details live separately from memories.
  Only reviewed descriptions and observations enter briefing and ritual context.
  Evidence IDs distinguish image-derived statements from human-written quotes;
  exact-quote validation checks the corresponding source. Story questions are
  invitations, not factual evidence or user preferences.
- **Durable processing:** The existing worker claims revision-bound photo jobs
  with leases. Editing, deleting, revoking consent, or cancelling prevents a late
  result from becoming usable. Source access rules also apply to collections.
- **Safety:** Prompts prohibit inferred identities, relationships, health,
  emotions, precise dates, or locations. Named Diwali suggestions require Diwali
  in the supplied story. Human review remains necessary; schema validation alone
  cannot prove an observation true. Family-approved themes determine collections.
- **Costs:** Unchanged photos reuse their stored analysis. Each new request has
  a 1800-token output ceiling and no automatic paid retry. A family-level limit
  defaults to ten requests per 24-hour rate-limit window, with the existing
  shared hourly AI limit also enforced. Failed requests count toward the limit.

Set these server-side values in `.env.local` (never expose the API key to clients):

```dotenv
NEBIUS_VISION_MODEL=nvidia/Nemotron-3.5-Super-VL
TOGETHERLY_PHOTO_DAILY_LIMIT=10
```

The existing `NEBIUS_API_KEY` is reused. The photo limit accepts integers from
1 to 50; invalid values fall back to 10. Keep `AI_PROVIDER=fixture` only for
offline testing: those results are explicitly labeled as previews, not image
analysis. Both app and worker must use the same environment and storage.

Cancellation or revocation cannot recall data already sent to a provider or
refund an in-flight request. It prevents accepting that result and removes local
photo-derived evidence; it does not promise deletion from a provider's systems.

## Verification

- Full offline suite: 176 tests passed; 13 opt-in live tests skipped.
- Photo browser flow covers review, original story/date/place preservation,
  visual-detail search, desktop and 390/320px layouts, image loading, a themed
  memory walk, navigation, consent revocation, and family permission boundaries.
- Final browser run: six tests passed across photos, personal briefings, and
  rituals; the opt-in live Hermes browser test was skipped.
- Live verification on October 27, 2026 used only `public/demo/garden.jpg`.
  Five vision requests were used during provider compatibility testing. The final
  JSON-only request succeeded with 978 input and 494 output tokens. Forced tool
  calling was rejected as a transport after inconsistent duplicate responses.
  No private family photographs were used for live diagnostics.
- Further live checks are opt-in through `scripts/check-photo-ai.ts --live`.
  Routine tests mock the provider or use fixtures and spend no Nebius credits.

For browser tests, always isolate **both** `ANUBANDH_DATABASE_PATH` and
`ANUBANDH_STORAGE_PATH` under a temporary directory. Never run destructive tests
against the real family database, encrypted media, or media key.

## Current Scope

There is no automatic face identification, cloud-photo import, bulk analysis of
old uploads, multi-author story thread, or generated fictional family history.
Analysis starts from a selected approved photo and requires review before reuse.
Collections currently support celebrations, Diwali, meals, music, outdoors,
travel, and everyday moments. Creating a walk includes up to 30 source memories.
