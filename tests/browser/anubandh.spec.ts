import { test, expect, type Page } from "@playwright/test";

async function sample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open a sample family" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Asha." }),
  ).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/family");
    return response.json();
  });
}
async function switchDemo(page: Page, name: string) {
  await page.goto("/choices");
  await page.getByRole("button", { name }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("Togetherly branding, tagline, and memory export", async ({ page }) => {
  const tagline = "Because relationships deserve remembering.";
  await page.goto("/");
  await expect(page).toHaveTitle(`Togetherly | ${tagline}`);
  await expect(
    page.getByRole("heading", { name: "Togetherly", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-tagline")).toHaveText(tagline);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/togetherly-signin-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await sample(page);
  await expect(
    page.getByRole("link", { name: "Togetherly home" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-footer > span")).toHaveText(tagline);
  await expect
    .poll(
      () =>
        page
          .locator(".moment-visual img")
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      { timeout: 45000 },
    )
    .toBeGreaterThan(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/togetherly-home-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator(".brand")).toContainText("Togetherly");
    await expect(page.locator(".brand small")).toHaveText(tagline);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/togetherly-menu-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
  }
  const exported = await page.request.get("/api/export");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-disposition"]).toContain(
    "togetherly-memories.json",
  );
});

test("personal home albums, people filters, and user-controlled motion", async ({
  page,
}) => {
  await sample(page);
  const data = await snapshot(page);
  await expect(page.locator(".sidebar")).toHaveJSProperty("inert", true);
  await expect(
    page.getByRole("navigation", { name: "Everyday navigation" }),
  ).toBeVisible();
  const collection = page.locator(".moment-shell").first();
  await page
    .getByRole("button", { name: "Peek inside Little moments", exact: true })
    .click();
  await expect(collection).toHaveAttribute("data-preview", "true");
  await expect(collection.locator(".moment-art-excerpt")).toHaveText(
    data.memories.find(
      (m: { status: string; kind: string }) =>
        m.status === "approved" && m.kind === "photo",
    ).caption,
  );
  await page
    .getByRole("button", { name: "Show cover of Little moments", exact: true })
    .click();
  await expect(collection).toHaveAttribute("data-preview", "false");
  await expect
    .poll(
      () =>
        collection
          .locator(".moment-visual img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      { timeout: 45000 },
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/screenshots/personal-home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  const title = await page
    .getByRole("dialog")
    .locator("h2")
    .first()
    .textContent();
  expect(
    data.memories
      .filter((m: { status: string }) => m.status === "approved")
      .map((m: { title: string }) => m.title),
  ).toContain(title);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Memories with Rohan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Memories with Rohan", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "With Rohan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Through the lens", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Everyone", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Through the lens", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".page-heading .button")).toHaveCSS(
    "width",
    "48px",
  );
  await expect(collection).toHaveCSS("height", "300px");
  // Resizing can preserve the browser's currently snapped collection.
  await page.locator(".moments-strip").evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
  await expect.poll(() => page.locator(".moments-strip").evaluate((element) => element.scrollLeft)).toBeLessThan(5);
  await page
    .getByRole("button", { name: "Next collections", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator(".moments-strip").evaluate((element) => element.scrollLeft),
    )
    .toBeGreaterThan(50);
  await page
    .getByRole("button", { name: "Previous collections", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator(".moments-strip").evaluate((element) => element.scrollLeft),
    )
    .toBeLessThan(5);
  await collection.scrollIntoViewIfNeeded();
  const caption = await collection
    .locator(".moment-cover-caption")
    .boundingBox();
  const tabs = await page
    .getByRole("navigation", { name: "Quick navigation" })
    .boundingBox();
  expect(caption!.y + caption!.height).toBeLessThan(tabs!.y);
  await page.screenshot({
    path: "test-results/screenshots/personal-home-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await collection.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
  ).toBe("none");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
});

test("design system across routes and account access", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({
    path: "test-results/screenshots/account-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/account-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open a sample family" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Asha." }),
  ).toBeVisible();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of [
      "family",
      "calls",
      "messages",
      "choices",
      "review",
      "contribute",
    ]) {
      await page.goto(`/${view}`);
      await expect(page.locator(".page-heading h1")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/${view}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("filter recovery, accessible mobile navigation, and reduced motion", async ({
  page,
}) => {
  await sample(page);
  await page.goto("/memories");
  await page
    .getByRole("textbox", { name: "Find a memory" })
    .fill("no-such-family-memory-8675309");
  await expect(
    page.getByRole("heading", { name: "No matching memories" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".memory-card").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Search memories", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search all memories" })
    .fill("no-such-family-memory-8675309");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "No matching memories" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".search-results > button").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toHaveJSProperty("inert", true);
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".workspace")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator(".workspace")).toHaveJSProperty("inert", false);
  await page.getByRole("button", { name: "Toggle larger text" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle larger text" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Toggle larger text" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Toggle larger text" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open Little moments" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Quick navigation" })
    .getByRole("link", { name: "People", exact: true })
    .click();
  await expect(page).toHaveURL(/\/family$/);
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Add a person", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Add a familiar person" }),
  ).toBeVisible();
});

test("photo collections, source inspection, removal, and simple mobile navigation", async ({
  page,
}) => {
  await sample(page);
  const data = await snapshot(page);
  const approved = data.memories.filter(
    (m: { status: string }) => m.status === "approved",
  );
  await page.getByRole("button", { name: "Open Little moments" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Little moments", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: approved[0].title, exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Previous memory" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Next memory" }).click();
  await expect(
    dialog.getByRole("heading", { name: approved[1].title, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    dialog.getByRole("heading", { name: approved[0].title, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("heading", { name: approved[1].title, exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "View original" }).click();
  await expect(
    dialog.getByText(approved[1].caption, { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Little moments" }).click();
  await expect
    .poll(
      () =>
        dialog
          .locator(".journey-photo img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      { timeout: 45000 },
    )
    .toBeGreaterThan(0);
  await expect(dialog.locator(".journey-photo")).toHaveAttribute(
    "data-loading",
    "false",
  );
  await expect
    .poll(() =>
      dialog
        .locator(".journey-photo")
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBeLessThanOrEqual(240);
  await expect
    .poll(() => dialog.evaluate((d) => d.scrollWidth <= d.clientWidth))
    .toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/memory-viewer-mobile.png",
  });
  const deleted = await page.request.post("/api/family", {
    data: { action: "memory-delete", id: approved[0].id },
  });
  expect(deleted.ok()).toBe(true);
  await expect(
    dialog.getByRole("heading", { name: "Memory no longer available" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your day" }).click();
  const tabs = page.getByRole("navigation", { name: "Quick navigation" });
  await tabs.getByRole("link", { name: "Memories", exact: true }).click();
  await expect(page).toHaveURL(/\/memories$/, { timeout: 45000 });
  await expect(
    tabs.getByRole("link", { name: "Memories", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("family contribution, source approval, recorded reply, and private delivery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await sample(page);
  await expect
    .poll(() =>
      page
        .locator("button.daily-photo img")
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/screenshots/today-desktop.png",
    fullPage: true,
  });
  await switchDemo(page, "Meera · Daughter");
  await expect(
    page.getByRole("heading", { name: "Hello, Meera." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a memory", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Story", exact: true }).click();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("A new balcony flower");
  await dialog
    .getByLabel("The details you know")
    .fill(
      "Meera planted a jasmine flower on Tuesday. She wants to share a photograph next week.",
    );
  await dialog.getByRole("checkbox", { name: "Meera", exact: true }).check();
  await dialog.getByRole("button", { name: "Save for review" }).click();
  await expect(dialog).not.toBeVisible();
  let data = await snapshot(page);
  expect(
    data.memories.find(
      (m: { title: string }) => m.title === "A new balcony flower",
    ).status,
  ).toBe("pending");
  await switchDemo(page, "Asha · Primary user");
  await page.goto("/review");
  await page.getByRole("button", { name: /A new balcony flower/ }).click();
  await page
    .getByRole("button", { name: "Approve memory", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  data = await snapshot(page);
  expect(
    data.memories.find(
      (m: { title: string }) => m.title === "A new balcony flower",
    ).status,
  ).toBe("approved");
  await page.goto("/messages");
  await page.getByRole("button", { name: "New reply" }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "To", exact: true })
    .selectOption({ label: "Meera · Your daughter" });
  await page.getByRole("button", { name: "Record a voice reply" }).click();
  await expect(
    page.getByRole("button", { name: /Stop recording/ }),
  ).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Stop recording/ }).click();
  await expect(page.getByRole("dialog").locator("audio")).toBeVisible();
  await page
    .getByLabel("Or write a message")
    .fill("I would love to hear about your garden.");
  await page.getByRole("button", { name: "Save reply for review" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve and send to Meera" }),
  ).toBeVisible();
  data = await snapshot(page);
  const draft = data.messages.find(
    (m: { status: string }) => m.status === "draft",
  );
  expect(draft.media_id).toBeTruthy();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Approve and send to Meera" }).click();
  await expect(
    page.getByRole("button", { name: "Approve and send to Meera" }),
  ).not.toBeVisible();
  await switchDemo(page, "Meera · Daughter");
  await page.goto("/messages");
  await expect(
    page.getByText("I would love to hear about your garden.", { exact: true }),
  ).toBeVisible();
  const audio = page.locator("audio").first();
  await expect(audio).toBeVisible();
  await expect
    .poll(() => audio.evaluate((a: HTMLAudioElement) => a.readyState))
    .toBeGreaterThan(0);
  const media = await page.request.get(`/api/media/${draft.media_id}`, {
    headers: { Range: "bytes=0-99" },
  });
  expect(media.status()).toBe(206);
  expect(media.headers()["content-type"]).toContain("audio/");
  await page.screenshot({
    path: "test-results/screenshots/messages-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("responsive views, image loading, keyboard dialog, and source deletion", async ({
  page,
}) => {
  await sample(page);
  const data = await snapshot(page);
  const memory = data.memories.find(
    (m: { status: string }) => m.status === "approved",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/today-${width}.png`,
      fullPage: true,
    });
    if (width === 320) {
      await expect(page.locator(".mobile-brand")).toContainText("Togetherly");
      await page.getByRole("button", { name: "Toggle larger text" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await page.getByRole("button", { name: "Toggle larger text" }).click();
    }
    await page.goto("/memories");
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/vault-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Search memories", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const deletion = await page.request.post("/api/family", {
    data: { action: "memory-delete", id: memory.id },
  });
  expect(deletion.ok()).toBe(true);
  if (memory.media_id)
    expect(
      (await page.request.get(`/api/media/${memory.media_id}`)).status(),
    ).toBe(404);
});

test("authentication, origin validation, and cross-family media isolation", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const page = await first.newPage();
  const other = await second.newPage();
  await sample(page);
  await sample(other);
  const data = await snapshot(page);
  const image = data.memories.find(
    (m: { media_id: string | null }) => m.media_id,
  );
  expect(
    (await other.request.get(`/api/media/${image.media_id}`)).status(),
  ).toBe(404);
  expect(
    (
      await other.request.post("/api/family", {
        data: { action: "memory-delete", id: image.id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/family", {
        headers: { Origin: "https://malicious.example" },
        data: { action: "generate", kind: "briefing" },
      })
    ).status(),
  ).toBe(403);
  await first.close();
  await second.close();
});

test("live Nemotron background briefing uses approved synthetic sources", async ({
  page,
}) => {
  test.skip(
    process.env.ANUBANDH_LIVE_TEST !== "1",
    "Explicitly opt in to billable synthetic inference.",
  );
  await sample(page);
  try {
    await page.getByRole("button", { name: "Prepare my briefing" }).click();
    await page
      .getByRole("button", { name: "Allow and prepare this brief" })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect
      .poll(
        async () => {
          const data = await snapshot(page);
          return data.artifacts.some(
            (a: { provider: string }) => a.provider === "token-factory",
          );
        },
        { timeout: 110000, intervals: [3000, 5000] },
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByText("Prepared with Nemotron")).toBeVisible();
    const data = await snapshot(page);
    const artifact = data.artifacts.find(
      (a: { kind: string }) => a.kind === "briefing",
    );
    const content = JSON.parse(artifact.content);
    expect(content.version).toBe(2);
    for (const item of content.items) {
      const source = data.memories.find(
        (m: { id: string }) => m.id === item.sourceId,
      );
      expect(source.status).toBe("approved");
      expect(source.caption).toContain(item.quote);
      expect(item.text.length).toBeLessThanOrEqual(220);
      expect(item.text.trim().split(/\s+/).length).toBeLessThanOrEqual(32);
      expect(item.starters.length).toBeGreaterThanOrEqual(2);
      expect(item.starters.every((s: string) => !s.startsWith("Would you like to talk about"))).toBe(true);
    }
    await page.screenshot({
      path: "test-results/screenshots/live-briefing.png",
      fullPage: true,
    });
  } finally {
    await page.request.post("/api/family", {
      data: {
        action: "settings",
        language: "en",
        timezone: "Asia/Kolkata",
        hour: 8,
        cloud: false,
      },
    });
  }
});

test("real accounts, relationship correction, microphone cancellation, and revocation", async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create family", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Test Parent");
  await page.getByLabel("Family name").fill("Synthetic account test");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`parent-${suffix}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-test-password");
  await page.getByRole("button", { name: "Create my family space" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Test Parent." }),
  ).toBeVisible();
  const invite = await page.request.post("/api/family", {
    data: {
      action: "invite",
      name: "Test Relative",
      relationship: "Daughter",
      view: true,
      contribute: true,
      schedule: false,
    },
  });
  expect(invite.ok()).toBe(true);
  const { token } = await invite.json();
  const relativeContext = await browser.newContext();
  const relative = await relativeContext.newPage();
  await relative.goto(`/join/${token}`);
  await relative
    .getByLabel("Email", { exact: true })
    .fill(`relative-${suffix}@example.test`);
  await relative
    .getByLabel("Password", { exact: true })
    .fill("synthetic-relative-password");
  await relative.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    relative.getByRole("heading", { name: "Hello, Test Relative." }),
  ).toBeVisible();
  const joined = await snapshot(relative);
  await expect(relative.getByText("Sample family accounts")).toHaveCount(0);
  expect(
    (
      await relative.request.post("/api/account", {
        data: { action: "demo-person", memberId: joined.member.id },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/family");
  await page
    .getByRole("button", { name: "Correct details for Test Relative" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Relationship", { exact: true })
    .fill("Niece");
  await page.getByRole("button", { name: "Save person" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Your niece", { exact: true })).toBeVisible();

  // Resolve microphone permission after the user has closed the recording dialog.
  await page.goto("/messages");
  await page.getByRole("button", { name: "New reply" }).click();
  await page.evaluate(() => {
    const state = window as unknown as { testMicStream?: MediaStream };
    const acquire = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await acquire(constraints);
      state.testMicStream = stream;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return stream;
    };
  });
  await page.getByRole("button", { name: "Record a voice reply" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as unknown as { testMicStream?: MediaStream }).testMicStream,
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { testMicStream?: MediaStream }).testMicStream
          ?.getTracks()
          .every((t) => t.readyState === "ended"),
      ),
    )
    .toBe(true);

  const revoke = await page.request.post("/api/family", {
    data: {
      action: "access",
      id: joined.member.id,
      active: false,
      view: false,
      contribute: false,
      schedule: false,
      expiresAt: null,
    },
  });
  expect(revoke.ok()).toBe(true);
  expect((await relative.request.get("/api/family")).status()).toBe(401);
  await relativeContext.close();
});
