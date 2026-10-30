import { test, expect } from "@playwright/test";
import type { Snapshot } from "../../lib/anubandh/types";

test("relationship labels follow the viewer across people, conversation, and replies", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open a sample family" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Asha." })).toBeVisible();
  const data: Snapshot = await (await page.request.get("/api/family")).json();
  const daughter = data.members.find(m => m.relationship === "Daughter")!;
  const son = data.members.find(m => m.relationship === "Son")!;
  expect((await page.request.post("/api/family", { data: {
    action: "person-edit", id: daughter.person_id, name: "Ruhi", relationship: "Daughter", about: "",
  } })).ok()).toBe(true);
  await page.goto("/family");
  await expect(page.locator(".person-card").filter({ has: page.getByRole("heading", { name: "Ruhi", exact: true }) }).locator(".relationship")).toHaveText("Your daughter");
  expect((await page.request.post("/api/account", { data: { action: "demo-person", memberId: son.id } })).ok()).toBe(true);
  await page.goto("/family");
  const ruhi = page.locator(".person-card").filter({ has: page.getByRole("heading", { name: "Ruhi", exact: true }) });
  await expect(ruhi.locator(".relationship")).toHaveText("Your sister");
  await expect(page.locator(".person-card").filter({ has: page.getByRole("heading", { name: "Rohan", exact: true }) }).locator(".relationship")).toHaveText("You");
  await page.goto(`/conversation?person=${daughter.person_id}`);
  await expect(page.locator(".conversation-person")).toContainText("Your sister");
  await page.goto("/messages");
  await page.getByRole("button", { name: "New reply" }).click();
  const recipient = page.getByRole("dialog").getByRole("combobox", { name: "To", exact: true });
  await recipient.selectOption(daughter.id);
  await expect(recipient.locator("option:checked")).toHaveText("Ruhi · Your sister");
  await page.keyboard.press("Escape");
  await page.goto("/family");
  await page.getByRole("heading", { name: "Your people", exact: true }).click();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/screenshots/viewer-relationships-${width}.png`, fullPage: true });
  }
});

test("personal brief UI separates captions, original evidence, and source-linked starters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open a sample family" }).click();
  await expect(page.getByRole("heading", { name: "Hello, Asha." })).toBeVisible();
  const data: Snapshot = await (await page.request.get("/api/family")).json();
  const person = data.people.find(p => p.relationship === "Daughter")!;
  const memory = data.memories.find(m => m.status === "approved" && m.caption.includes("balcony") && JSON.parse(m.person_ids).includes(person.id))!;
  const scheduled = await page.request.post("/api/family", { data: { action: "call-add", personId: person.id, scheduledAt: Date.now() + 7200000, note: "" } });
  expect(scheduled.ok()).toBe(true);
  const { id: callId } = await scheduled.json();
  const summary = "Meera shared a family moment from her balcony garden.";
  const starters = ["Meera, what do you enjoy most about your balcony garden?", "Which part of your garden would you like to show us?"];
  // Rendering contract only: provider behavior and evidence validation are tested separately.
  await page.route("**/api/family", async route => {
    const response = await route.fetch();
    if (route.request().method() !== "GET") { await route.fulfill({ response }); return; }
    const snapshot: Snapshot = await response.json();
    snapshot.artifacts = [{ id: "synthetic-caption-preview", family_id: data.family.id, member_id: data.member.id,
      kind: "call", call_id: callId, provider: "token-factory", model: "synthetic-ui-response", language: "en", created_at: Date.now(),
      content: JSON.stringify({ version: 2, items: [{ sourceId: memory.id, quote: memory.caption, text: summary, starters }], topics: starters }),
    }];
    await route.fulfill({ response, json: snapshot });
  });
  await page.goto("/calls");
  const brief = page.locator(".brief-view").filter({ hasText: "Prepared with Nemotron" });
  await expect(brief.locator(".brief-item > div > p")).toHaveText(summary);
  await expect(brief.locator(".brief-evidence p")).not.toBeVisible();
  await brief.getByText("Original words", { exact: true }).click();
  await expect(brief.locator(".brief-evidence p")).toHaveText(memory.caption);
  await brief.getByText("Original words", { exact: true }).click();
  await expect(brief.locator(".conversation-topic")).toHaveCount(2);
  await expect(brief.locator(".conversation-topic").first()).toContainText(starters[0]);
  await brief.getByRole("button", { name: "Original memory", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText(memory.caption);
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "Family calls", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/screenshots/personal-brief-${width}.png`, fullPage: true });
  }
  await page.unrouteAll({ behavior: "wait" });
});
