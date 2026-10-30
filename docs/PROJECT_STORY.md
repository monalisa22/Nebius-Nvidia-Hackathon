# Togetherly

*Because relationships deserve remembering.*

## Inspiration

"Nani, remember the song I told you about?" You remember singing to your grandson as a child, but cannot recall last week's update. You love him. You just need a little context.

Distance, busy lives, and early cognitive difficulties can interrupt these small connections. **What if AI helped us stay involved in each other's lives, instead of just storing more information?**

Togetherly helps people remember what matters to loved ones, express themselves, and keep family conversations going.

## What it does

Togetherly is a **private, invitation-only Relationship Companion AI**, designed for families across generations, with particular attention to people experiencing early cognitive difficulties.

The current application brings together:

- **Today in my family:** Swipe through daily memory moments and short Nemotron-generated updates. Anniversaries use confirmed event dates.
- **Conversation support:** Prepare readable reminders and personal questions before a call. Keep approved context beside an external call; the companion does not listen to it.
- **People and what matters:** Connected profiles hold reviewed interests, milestones, birthdays, and explicitly shared feelings. Family labels adapt to the viewer: daughter for a parent, sister for a sibling.
- **Family Memory Vault and legacy stories:** Preserve photographs, stories, and original voice recordings with people, places, and dates. Contributions are reviewed before becoming shared AI context.
- **More from a photograph:** Nemotron suggests visible details and a gentle story question without replacing your caption. Reviewed themes gather Diwali, celebrations, meals, and other moments into swipeable collections that become memory walks.
- **Memory walks and shared activities:** Revisit memories at your own pace, save your place, or invite a grandchild to preserve a recipe or story. Celebrate participation without competitive scores.
- **Replies and future capsules:** Review a written or recorded message, then approve delivery to a family inbox now or later.
- **Gentle reconnection:** Optional reminders use recorded interactions. Opt-in Bharosa notices alert a chosen relative to missed explicit check-ins, not inferred isolation.
- **Personal control:** Choose access, sources, and expiry; correct or delete memories. Larger text, reduced motion, and optional on-device read-aloud support comfortable use.

Togetherly supports connection and communication, not diagnosis, treatment, or emergency monitoring.

## How we built it

**Application stack:** Next.js 16, React 19, TypeScript, Node.js, SQLite/better-sqlite3, Zod, custom CSS, and Lucide icons. MediaRecorder captures voice messages; Vitest and Playwright test logic and browser workflows.

**NVIDIA model, Nebius inference:** **NVIDIA Nemotron 3 Nano 30B-A3B**, an open-source model, runs through **Nebius Token Factory's OpenAI-compatible API**. It selects updates, writes captions and questions, extracts reviewable personal details, and supports English/Hindi briefings. Nebius serves inference; our application and worker currently run locally.

**Photo understanding:** **NVIDIA Nemotron-3.5-Super-VL** on Nebius analyzes only selected photos under a separate opt-in permission. Sharp resizes a temporary copy; a bounded JSON response is validated with Zod. The family reviews visible observations, questions, and themes. Original stories remain intact, and identities, dates, and relationships are not inferred from appearance. Cached results and a daily request cap conserve credits.

**Grounded memory:** Permission-filtered SQL retrieval supplies approved, unexpired captions and reviewed photo evidence. Text-model function-call outputs carry source IDs and exact excerpts, checked with Zod and application validation. Separate evidence IDs distinguish visual observations from the contributor's words. Source changes invalidate stale results. AI paraphrases remain reviewable, not guaranteed facts. Raw recordings stay out of inference.

**Reusable skills:** Our Python-based **NousResearch Hermes Agent** pilot uses Nemotron to load an approved routine, retrieve chosen updates, consult recent preparations, and propose call support. "Two memories, one question, simple language" becomes a versioned preference after approval. The agent cannot grant permissions or send messages. Live CLI verification succeeded; final live browser verification is pending.

**Efficient automation:** Nano handles language; code handles relationships, permissions, and delivery. Small contexts, output limits, and disabled extended thinking in the Hermes Nano preset limit generation. Persistent jobs, worker leases, bounded retries, and deduplication support opt-in extraction, scheduled preparation, and approved capsule delivery while the worker runs.

**Privacy:** One-use invitations, revocable sessions, source-level permissions, and AES-256-GCM media encryption protect workflows. Persistent memory stays in Togetherly. The server holds media keys; SQLite text is unencrypted, and approved text and separately permitted selected photos reach Nebius. This is not end-to-end encryption or OS-level sandboxing.

## Challenges we ran into

- **Personal without inventing:** We added viewer-relative context and source checks to preserve attribution while generating natural questions.
- **Helpful without overstepping:** Changing permissions required fresh checks before saving results or delivering messages.
- **Simple despite complexity:** We separated everyday views from administration and made slow inference visible as background work.

## Accomplishments that we're proud of

- Connecting contribution, approval, real Nemotron preparation, and an explicitly approved family reply.
- Combining persistent memory, reusable routines, chosen information sources, and permission-controlled actions in one Personal AI workflow.
- Preserving the person's own voice and choices instead of making an AI speak for them.

## What we learned

Useful personal AI brings the right context at the right time, explains its sources, and knows when to ask. Success means a meaningful family interaction, not more scrolling.

## What's next for Togetherly

Planned capabilities, not current integrations:

- **Less manual input:** Consented contact sync, selected Google Photos imports, scoped email updates where APIs permit, and reviewed multilingual transcription.
- **Richer communication:** Help Me Say It word-finding assistance, consented live-call support, and permission-scoped family-supporter handovers.
- **Memory Garden:** Familiar songs, festival storytelling, pressure-free quizzes, intergenerational story completion, and badges; richer family timelines and milestone-triggered capsules.
- **Safer release:** Finish live browser verification, resolve outstanding media recovery, strengthen backups and account recovery, and prepare an HTTPS demo and Android package. Evaluate NVIDIA OpenShell/NemoClaw isolation and Nebius-hosted application infrastructure; these are not integrated today.

Family usability research will guide development. Connection insights will use explicit sharing, not relationship scores or inferred distress; no clinical benefit is claimed.

**Not just helping you remember your loved ones. Helping your loved ones stay connected to you.**
