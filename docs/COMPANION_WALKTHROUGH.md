# Togetherly relationship companion walkthrough

Start the app and worker with `npm run dev`, then open
http://127.0.0.1:3000. Choose **Open a sample family** for a separate fictional
workspace. Existing real family data is not changed. Use the menu for
**Family calls**, **My choices**, and **Review memories**.

## Your day

The family portraits filter the moments by person. Swipe horizontally or use
the arrows beside **Your memory moment**; keyboard arrows also work when the
memory rail is focused. Open a moment to inspect its original caption or send
its contributor a reply. The albums below remain available.

Anniversaries require a supplied event date; an upload timestamp is never
treated as the date a memory happened.

## From a memory to a conversation

1. Open **Memories**, add a story, and tag a person mentioned in its caption.
2. Open **Review memories** and approve the contribution as the primary user.
3. Open its original memory. **Story details** saves a date, place, and whether
   the memory belongs in Family stories.
4. Under **Things worth remembering**, select the person and category, paste
   an exact excerpt of the caption, and save for review.
5. Open **People -> What matters -> For review**. Approve or decline the detail.
6. Open that person's **What matters** view and start **Conversation companion**.
   Approved details and original memories appear together. Explicitly record
   **We spoke today** or **We met today** when appropriate.
7. Correct or delete the original memory. Its old derived facts disappear.

The companion is a reference alongside an external call, not an embedded call
or microphone listener. Starting it does not claim that a call happened.

## Nemotron suggestions

The primary user can enable **Allow AI family briefings and personal details**
under **My choices**. In an approved, tagged memory, choose **Find personal
details** and confirm processing. The worker calls Nemotron through Nebius,
validates exact caption excerpts, and leaves every suggestion pending review.
Track preparation and retry/cancel jobs under My choices.

**Automatically suggest details from newly approved memories** is a separate,
off-by-default choice. It never approves facts or sends messages. Raw recordings
and photographs are not sent to this model; captions are contributor-supplied,
not automatic transcripts. Provider errors never silently become fixture output.

**Photo understanding** is a separate opt-in workflow. In My choices, allow AI
for photographs you choose, then open an approved photo and select **Explore this
photo**. Review the suggestions without changing the original story. Kept themes
appear in **Memories -> Threads of our lives**, where a collection can become a
memory walk. Reviewed visual evidence also becomes available to fresh briefings
and call preparations. See [the complete photo walkthrough](PHOTO_UNDERSTANDING.md).

## Family connections

Open **People -> Family connections**. The primary user can add or remove an
explicit parent, partner, or sibling link between existing people. Each person
opens their approved context. Relationships are not inferred from photographs.

## Make a memory together

1. Open **Memories -> Make a memory** and choose a prompt.
2. Select the participant and the person whose story they will preserve.
3. An invitation to yourself starts accepted. An invited relative can accept
   or decline from their own account.
4. **Keep our story** opens a contribution with the person already tagged.
   Record original audio or switch to a written story.
5. After primary-user review, select your approved contribution and choose
   **We made a memory**. The milestone links to that original source.

There are no public rankings, response-pressure scores, or streak penalties.
In a sample family, account switching is available in My choices. Real relatives
must use their own invited accounts.

## Take a memory walk

Open **Memories -> Memory walks**, name a walk, select approved moments, and use
the ordering arrows before saving. Advance manually, pause, or leave and return.
Your position is persisted. **Visit again** restarts a completed walk. If the
current source disappears, the app says so and lets you choose another moment.
Deleting a walk does not delete its original memories. Audio never autoplays.

## A message for later

Open **Messages -> For later**, choose a recipient, record or write a message,
and choose a future device-local date/time. Save the private capsule, then
approve the displayed recipient and delivery time. Scheduled times are shown
in the family's timezone.

Changing the date requires fresh approval. You can cancel or delete a capsule.
Only the sender sees it before delivery, and it cannot be sent early through
ordinary draft controls. The running worker delivers it to the recipient's
Togetherly inbox, not SMS, email, or push. Offline workers deliver eligible
overdue capsules after restarting and rechecking permissions.

## Your connection choices

Enable optional reconnect reminders and choose the number of days between
recorded interactions. For missed check-ins, explicitly select a trusted relative
and an interval. **I'm here today** records an intentional check-in; page visits
and background polling do not. Turning check-ins off removes the notices.
This is not emergency detection, medical monitoring, or a relationship rating.

## Integration boundaries

Google Photos import requires a configured Google OAuth client and a separate
consented import implementation. Automatic transcription needs a selected speech
service or self-hosted speech model; the checked Nebius catalog did not expose
a speech-transcription model. Neither integration is presented as connected.
The current upload, recording, review, and AI-caption workflows work independently.
