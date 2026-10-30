# Togetherly UI

Brand tagline: "Because relationships deserve remembering."

The shared brand component uses a teal and rose linked-ribbon mark, a serif
wordmark with an italic rose ending, and the full tagline beneath it. The mark
also serves as the favicon. On phones, message notifications remain available
in the bottom navigation while the header keeps search and text-size controls.

## Direction

A private, photo-first family album, not an office dashboard. Keep original
photographs, real captions, and familiar faces prominent. No streaks, autoplay,
invented anniversaries, or engagement pressure.

The October 18 revision follows the user's Dribbble references. Their preview
images were inspected; reference artwork is not embedded in the application:

- [LifeTales](https://dribbble.com/shots/26804724-LifeTales-AI-Story-Writing-App):
  personal photographs and direct, family-centered actions.
- [WOLO](https://dribbble.com/shots/27747817-WOLO): portrait-led browsing and a
  social feed rather than a business navigation rail.
- [Memory app](https://dribbble.com/shots/21214649-Memory-app): distinct color
  accents that separate collections without dashboard metrics.
- [MEMENTO](https://dribbble.com/shots/27489210-MEMENTO-AI-Powered-Memory-App):
  memories as the primary browsing experience, not a chat input.
- [Social Memories](https://dribbble.com/shots/27532242-Social-Memories-App):
  people first, readable relationship labels, and large photographs.

## Foundations

- System sans-serif for controls and reading; Georgia for the wordmark, personal
  headings, album titles, and source excerpts. No remote font dependency.
- Charcoal text on white and light gray surfaces. Teal denotes primary actions,
  rose denotes memory/review accents, and blue denotes calls and support states.
- `app/globals.css` holds shared controls. `app/personal.css` defines the scoped
  consumer-app presentation and responsive album layout. `app/companion.css`
  extends those tokens for relationship-companion journeys.
- Cards and dialogs have a maximum eight-pixel radius. Sections use whitespace
  and dividers rather than nested cards. Shadows are reserved for interaction
  and overlays.
- Primary actions are at least 46 pixels tall; icon tools are 44 pixels square.
  Focus outlines remain visible. User-selected larger text persists locally.
- Transitions are brief and disabled for reduced-motion preferences.

## Surfaces

- Desktop: a compact top bar with four everyday destinations. The former sidebar
  is now an on-demand drawer on every screen size. The home page reads from family
  portraits to albums, a family update, and conversation preparation.
- Mobile: four stable bottom tabs and a dismissible, keyboard-contained drawer.
  Hidden navigation is inert. Collections scroll horizontally without widening
  the page. No horizontal page scrolling at 320 pixels.
- Sign-in: a compact form with familiar photographic context; not a landing page.
- Memories: explicit no-result feedback with a reset action. The viewer retains
  source inspection, original captions, manual navigation, and private replies.
- Family portraits filter home memories by approved people tags. Everyone resets
  the selection. Missing or removed people do not leave an unusable filter.
- Albums have a short staggered entrance and a small hover lift. A separate peek
  control reveals a real source caption, and Surprise me opens a memory from the
  currently visible approved collections. Neither action stores new data.
- Shelf controls and touch scrolling are user-paced. Motion is disabled when the
  system requests reduced motion. The drawer locks background scrolling, makes
  background controls inert, contains keyboard focus, and supports Escape.
- Loading and route errors: branded feedback without exposing family data or
  raw error details. The error boundary uses this installed Next.js version's
  `retry` API.

## Boundaries

### Relationship companion revision: October 25

Your day begins with person filters and individual swipeable moments, followed
by an optional invitation to reconnect and the existing albums. The four main
destinations remain. Secondary navigation separates Family stories, Make a
memory, and Memory walks under Memories; Family connections and What matters
under People; and For later under Messages. Conversation support lives with
Family calls and person profiles.

Source photos remain inspectable. Walks and recordings do not autoplay.
Activities use optional invitations and personal milestones without rankings.
Capsules keep their approval and rescheduling controls separate from normal
messages. Settings distinguish AI processing consent, automatic suggestions,
reconnection reminders, and opt-in trusted check-ins.

Existing routing, server actions, API contracts, authorization, storage, and
Nebius inference remain unchanged. Collections use already approved data;
Google Photos and Gmail connectors are not implemented by this redesign.

Browser coverage includes account access, all authenticated views at phone and
desktop widths, filtering recovery, mobile keyboard focus, persistent text size,
reduced motion, and the existing memory/call/message workflows.

## Verification: October 17, 2026

- Production build and TypeScript validation passed. Run builds with the dev
  server stopped; this workspace encountered malformed generated dev typings
  during overlapping build/dev activity. Generated typings were moved aside
  and regenerated, without changing application code to bypass validation.
- ESLint passed. All 57 offline tests passed with `--hookTimeout=30000` for slow
  cold imports on the Windows-mounted filesystem. Live inference was not rerun.
- Seven non-live Chromium workflows passed. Final layout and navigation checks
  were rerun after the last refinements, including the contextual person action.
- One final rerun received HTTP 500 during sample-family creation, before UI
  assertions. Subsequent sample creation and the affected isolated test passed.
  The server suppresses private exception details, so the cause was not established.
  This intermittent backend issue remains unresolved; the redesign does not claim
  to fix it or to certify production readiness.
