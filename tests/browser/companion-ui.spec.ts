import { expect, test, type Page } from "@playwright/test";
import type { Snapshot } from "../../lib/anubandh/types";
import type { CompanionSnapshot } from "../../lib/togetherly/service";

async function sample(page: Page) {
  expect(
    (
      await page.request.post("/api/account", {
        data: { action: "demo" },
        timeout: 45000,
      })
    ).ok(),
  ).toBe(true);
  return family(page);
}
async function family(page: Page): Promise<Snapshot> {
  return (await page.request.get("/api/family")).json();
}
async function companion(page: Page): Promise<CompanionSnapshot> {
  return (await page.request.get("/api/companion")).json();
}
async function capture(page: Page, name: string) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/${name}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
}
async function command(
  page: Page,
  data: Record<string, unknown>,
  endpoint = "companion",
) {
  const response = await page.request.post(`/api/${endpoint}`, { data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function story(page: Page, personId: string, title = "Meera's music") {
  const created = await command(
    page,
    {
      action: "memory-add",
      kind: "story",
      title,
      caption:
        "Meera loves playing the guitar. Meera says she feels excited about her concert.",
      personIds: [personId],
      audience: ["*"],
      mediaId: null,
      expiresAt: null,
    },
    "family",
  );
  await command(
    page,
    {
      action: "memory-review",
      id: created.id,
      revision: 1,
      decision: "approved",
    },
    "family",
  );
  return created.id as string;
}

test("daily swiping and companion routes fit desktop and mobile", async ({
  page,
}) => {
  test.setTimeout(300000);
  await sample(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your memory moment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next moment", exact: true }).click();
  await expect(page.locator(".daily-moments [aria-live]")).toContainText("2 /");
  await page.locator(".daily-rail").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".daily-moments [aria-live]")).toContainText("1 /");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/stories",
      "/activities",
      "/walks",
      "/family-tree",
      "/insights",
      "/capsules",
      "/conversation",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/companion-${route.slice(1) || "day"}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});

test("source review, family links and conversation support stay connected", async ({
  page,
}) => {
  const data = await sample(page);
  const person = data.people.find((p) => p.name === "Meera")!;
  const sourceId = await story(page, person.id);
  await page.goto("/memories");
  await page.getByRole("button", { name: /Meera's music/ }).click();
  await page.getByText("Story details", { exact: true }).click();
  await page.getByLabel("When this happened").fill("2021-04-12");
  await page.getByLabel("Place", { exact: true }).fill("Mumbai");
  await page.getByLabel("Keep in Family stories").check();
  await page.getByRole("button", { name: "Save story details" }).click();
  await expect(page.getByText("Story details saved.")).toBeVisible();
  await page.getByText("Things worth remembering", { exact: true }).click();
  await page
    .getByLabel("Exact words from this memory")
    .fill("Meera loves playing the guitar.");
  await page.getByRole("button", { name: "Save detail for review" }).click();
  await expect(
    page.getByText("Personal detail saved for review."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/insights");
  await expect(page.locator(".fact-card")).toHaveCount(0);
  await page.getByRole("button", { name: /For review/ }).click();
  await expect(page.locator(".fact-card")).toContainText(
    "Meera loves playing the guitar.",
  );
  await page.getByRole("button", { name: "Approve detail" }).click();
  await page.getByRole("button", { name: "Remembered", exact: true }).click();
  await expect(page.locator(".fact-card")).toHaveCount(1);
  await capture(page, "approved-personal-details");
  await page.goto(`/conversation?person=${person.id}`);
  await expect(page.getByLabel("Talking with")).toHaveValue(person.id);
  await expect(page.locator(".fact-card")).toContainText(
    "Meera loves playing the guitar.",
  );
  await page
    .getByRole("button", { name: "Start companion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "End companion" }),
  ).toBeVisible();
  await capture(page, "active-conversation");
  await page.getByRole("button", { name: "We spoke today" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "A little time together" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End companion" }).click();
  await page.goto("/family-tree");
  await page
    .getByRole("button", { name: "Add a connection", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Person", exact: true })
    .selectOption(person.id);
  await page
    .getByLabel("Related person")
    .selectOption(data.people.find((p) => p.name === "Aarav")!.id);
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.locator(".family-branch")).toContainText("Parent of");
  await capture(page, "family-connections");
  const current = (await family(page)).memories.find((m) => m.id === sourceId)!;
  await command(
    page,
    {
      action: "memory-edit",
      id: sourceId,
      revision: current.revision,
      title: current.title,
      caption: "Meera now plays the piano.",
      personIds: [person.id],
      audience: ["*"],
      expiresAt: null,
    },
    "family",
  );
  await page.goto(`/conversation?person=${person.id}`);
  await expect(page.locator(".fact-card")).toHaveCount(0);
});

test("walks keep their order and saved position without replacing a missing source", async ({
  page,
}) => {
  const data = await sample(page);
  const memories = data.memories
    .filter((m) => m.status === "approved")
    .slice(0, 3);
  await page.goto("/walks");
  await page.getByRole("button", { name: "Create a memory walk" }).click();
  await page.getByLabel("Name your walk").fill("Our Sundays");
  for (const memory of memories)
    await page.getByRole("checkbox", { name: memory.title }).check();
  await page.getByRole("button", { name: "Move moment 2 earlier" }).click();
  await page.getByRole("button", { name: "Save memory walk" }).click();
  await expect(page.locator(".walk-narration h2")).toHaveText(
    memories[1].title,
  );
  await capture(page, "saved-memory-walk");
  await page.getByRole("button", { name: "Next moment" }).click();
  await expect(page.locator(".walk-narration h2")).toHaveText(
    memories[0].title,
  );
  await page.getByRole("button", { name: "Your walks" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume walk" }).click();
  await expect(page.locator(".walk-narration h2")).toHaveText(
    memories[0].title,
  );
  await command(
    page,
    { action: "memory-delete", id: memories[0].id },
    "family",
  );
  await expect(
    page.getByRole("heading", { name: "This moment is no longer available" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next moment" }).click();
  await expect(page.locator(".walk-narration h2")).toHaveText(
    memories[2].title,
  );
  await page.getByRole("button", { name: "Finish this walk" }).click();
  await page.getByRole("button", { name: "Visit again" }).click();
  await expect(page.locator(".walk-narration h2")).toHaveText(
    memories[1].title,
  );
});

test("capsules stay private, require approval and can be rescheduled or cancelled", async ({
  page,
}) => {
  const data = await sample(page);
  const recipient = data.members.find((m) => m.role === "relative")!;
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/capsules");
  await page.getByRole("button", { name: "Create a capsule" }).click();
  await page
    .getByRole("combobox", { name: "For", exact: true })
    .selectOption(recipient.id);
  await page.getByLabel("Title", { exact: true }).fill("Your graduation day");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("A private note for your future self.");
  await page.getByRole("button", { name: "Save private capsule" }).click();
  await expect(page.locator(".capsule-card .badge")).toHaveText(
    "Private draft",
  );
  await page.goto("/messages");
  await expect(
    page
      .locator(".message-item")
      .filter({ hasText: "A private note for your future self." }),
  ).toHaveCount(0);
  await page.goto("/capsules");
  await page.getByRole("button", { name: "Approve delivery" }).click();
  await expect(page.locator(".capsule-card .badge")).toHaveText("scheduled");
  await capture(page, "scheduled-capsule");
  await page.getByRole("button", { name: "Change date" }).click();
  await page
    .getByLabel("Delivery time (your device time)")
    .fill("2027-06-20T09:00");
  await page.getByRole("button", { name: "Save new date" }).click();
  await expect(page.locator(".capsule-card .badge")).toHaveText(
    "Private draft",
  );
  await page.getByRole("button", { name: "Approve delivery" }).click();
  await page.getByRole("button", { name: "Cancel delivery" }).click();
  await expect(page.locator(".capsule-card .badge")).toHaveText("cancelled");
  await page
    .getByRole("button", { name: "Delete capsule Your graduation day" })
    .click();
  await expect(page.locator(".capsule-card")).toHaveCount(0);
});

test("an activity becomes a reviewed story and a personal milestone", async ({
  page,
}) => {
  const data = await sample(page);
  const person = data.people.find((p) => p.name === "Meera")!;
  await page.goto("/activities");
  await page
    .getByRole("button", { name: "Make time for this" })
    .first()
    .click();
  await page.getByLabel("Whose story will you share?").selectOption(person.id);
  await page.getByRole("button", { name: "Save this invitation" }).click();
  await page.getByRole("button", { name: "Keep our story" }).click();
  await expect(
    page.getByRole("button", { name: "Voice", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("checkbox", { name: "Meera", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Story", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("The story we made together");
  await page
    .getByLabel("The details you know")
    .fill("Meera shared the story of her first job in Mumbai.");
  await page.getByRole("button", { name: "Save for review" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/review");
  await page
    .getByRole("button", { name: /The story we made together/ })
    .click();
  await page.getByRole("button", { name: "Approve memory" }).click();
  await page.goto("/activities");
  const memory = (await family(page)).memories.find(
    (m) => m.title === "The story we made together",
  )!;
  await page.getByLabel("Our approved memory").selectOption(memory.id);
  await page.getByRole("button", { name: "We made a memory" }).click();
  await expect(page.locator(".activity-milestone")).toContainText(
    "1 memories made together",
  );
  await expect(page.locator(".completed-memory")).toHaveCount(1);
  await capture(page, "completed-family-activity");
  await page.getByRole("button", { name: "Revisit", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "The story we made together",
  );
});

test("check-in consent and connection preferences persist", async ({
  page,
}) => {
  const data = await sample(page);
  const trusted = data.members.find((m) => m.role === "relative")!;
  await page.goto("/choices");
  await page.getByLabel("Gentle reminders to reconnect").check();
  await page.getByLabel("Days between recorded connections").fill("14");
  await page
    .getByLabel("Let my trusted person know when I miss a check-in")
    .check();
  await page
    .getByRole("combobox", { name: "My trusted person", exact: true })
    .selectOption(trusted.id);
  await page.getByRole("button", { name: "Save connection choices" }).click();
  await expect(
    page.getByText("Your connection choices are saved."),
  ).toBeVisible();
  await page.goto("/");
  const before = (await companion(page)).preferences.checked_in_at;
  await page.getByRole("button", { name: "I'm here today" }).click();
  await expect
    .poll(async () => (await companion(page)).preferences.checked_in_at)
    .toBeGreaterThan(before);
  await page.goto("/choices");
  await page
    .getByLabel("Let my trusted person know when I miss a check-in")
    .uncheck();
  await page.getByRole("button", { name: "Save connection choices" }).click();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "I'm here today" }),
  ).toHaveCount(0);
});

test("open editors preserve their original revision after another session changes data", async ({
  page,
}) => {
  const data = await sample(page);
  const person = data.people.find((p) => p.name === "Meera")!;
  const sourceId = await story(page, person.id, "Concurrent family story");
  await page.goto("/memories");
  await page.getByRole("button", { name: /Concurrent family story/ }).click();
  await page.getByText("Story details", { exact: true }).click();
  await page
    .getByLabel("Place", { exact: true })
    .fill("Older unsaved location");
  await command(page, {
    action: "memory-context",
    sourceId,
    revision: (await family(page)).memories.find(m => m.id === sourceId)!.revision,
    occurredOn: "2021-01-01",
    place: "New confirmed location",
    legacy: true,
  });
  await expect(page.getByText(/Remembered date: 2021-01-01/)).toBeVisible();
  await page.getByRole("button", { name: "Save story details" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "This memory changed",
  );
  expect(
    (await companion(page)).memoryContext.find((m) => m.source_id === sourceId)
      ?.place,
  ).toBe("New confirmed location");
  await page.keyboard.press("Escape");
  const recipient = data.members.find((m) => m.role === "relative")!;
  const created = await command(page, {
    action: "capsule-create",
    recipientId: recipient.id,
    title: "Concurrent capsule",
    text: "A fictional future message",
    deliverAt: Date.now() + 7 * 86400000,
  });
  await command(page, {
    action: "capsule-approve",
    id: created.id,
    revision: 1,
  });
  await page.goto("/capsules");
  await page.getByRole("button", { name: "Change date" }).click();
  await command(page, {
    action: "capsule-cancel",
    id: created.id,
    revision: 2,
  });
  await expect(page.locator(".capsule-card .badge")).toHaveText("cancelled");
  await page.getByRole("button", { name: "Save new date" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(
    (await companion(page)).capsules.find((c) => c.id === created.id)?.status,
  ).toBe("cancelled");
});

test("live Nemotron proposes exact-source details for human review", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_LIVE_COMPANION !== "1",
    "Opt-in paid provider check using fictional data only.",
  );
  const data = await sample(page);
  const sourceId = await story(
    page,
    data.people.find((p) => p.name === "Meera")!.id,
    "Fictional live provider check",
  );
  const settings = {
    action: "settings",
    language: data.family.language,
    timezone: data.family.timezone,
    hour: data.family.briefing_hour,
  };
  try {
    await command(page, { ...settings, cloud: true }, "family");
    await command(page, { action: "extract", sourceId });
    await expect
      .poll(
        async () =>
          (await companion(page)).jobs.find((j) => j.source_id === sourceId)
            ?.status,
        { timeout: 90000, intervals: [1500, 3000] },
      )
      .toBe("completed");
    const result = await companion(page);
    const job = result.jobs.find((j) => j.source_id === sourceId)!;
    expect(job.provider).toBe("token-factory");
    expect(job.model).toContain("Nemotron");
    const facts = result.facts.filter((f) => f.source_id === sourceId);
    expect(facts.length).toBeGreaterThan(0);
    const source = (await family(page)).memories.find(
      (m) => m.id === sourceId,
    )!;
    for (const fact of facts) {
      expect(fact.status).toBe("pending");
      expect(source.caption).toContain(fact.quote);
    }
    await page.goto("/insights");
    await page.getByRole("button", { name: /For review/ }).click();
    await page.getByRole("button", { name: "Approve detail" }).first().click();
    await page.getByRole("button", { name: "Remembered", exact: true }).click();
    await expect(page.locator(".fact-card")).toHaveCount(1);
    console.log(
      `Live extraction verified: ${job.model}, ${facts.length} exact-source suggestions.`,
    );
  } finally {
    await command(page, { ...settings, cloud: false }, "family");
  }
});
