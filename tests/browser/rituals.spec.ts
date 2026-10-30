import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../lib/anubandh/types";
import type { CompanionSnapshot } from "../../lib/togetherly/service";

async function family(page: import("@playwright/test").Page) {
  expect((await page.request.post("/api/account", { data: { action: "demo" }, timeout: 90000 })).ok()).toBe(true);
  expect((await page.request.post("/api/family", { data: { action: "settings", language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true }, timeout: 90000 })).ok()).toBe(true);
  const data = await (await page.request.get("/api/family", { timeout: 90000 })).json() as Snapshot;
  const photo = data.memories.find(m => m.status === "approved" && m.media_id);
  if (photo) expect((await page.request.get(`/api/media/${photo.media_id}`, { timeout: 90000 })).ok()).toBe(true);
  return data;
}

test("connection ritual creation, persistence, preparation, mobile layout, and deletion", async ({ page }) => {
  const data = await family(page);
  const recipient = data.members.find(m => m.name === "Meera")!;
  await page.goto("/rituals");
  await page.getByRole("button", { name: "New ritual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Who is this time for?").selectOption(recipient.id);
  await dialog.getByLabel("Prepare with").selectOption("direct");
  await dialog.getByRole("group", { name: /Memories I allow/ }).getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "Save ritual" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "With Meera" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Prepare now" }).click();
  await expect(page.getByText("Offline preview / not AI generated")).toBeVisible({ timeout: 90000 });
  await page.getByText("Original words", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Open memory" })).toBeVisible();
  await page.locator(".ritual-moment img").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".ritual-moment img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/rituals-desktop.png", fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { name: "With Meera" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/rituals-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Pause ritual", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare now" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume ritual", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare now" })).toBeEnabled();
  await page.getByRole("button", { name: "Delete ritual", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete ritual", exact: true }).click();
  await expect(page.getByRole("heading", { name: "With Meera" })).not.toBeVisible();
});

test("ritual API rejects cross-origin commands and another member's run", async ({ page }) => {
  expect((await page.request.post("/api/companion", { data: { action: "ritual-run", id: "00000000-0000-4000-a000-000000000000" } })).status()).toBe(401);
  const data = await family(page);
  const target = data.members.find(m => m.name === "Meera")!;
  const source = data.memories.find(m => m.status === "approved" && (m.author_id === target.id || JSON.parse(m.person_ids).includes(target.person_id)))!;
  const command = { action: "ritual-save", skill: "call", engine: "direct", recipientId: target.id, sourceIds: [source.id], cadence: "manual", allowAction: false, expiresAt: null };
  expect((await page.request.post("/api/companion", { data: command, headers: { origin: "https://unrelated.example" } })).status()).toBe(403);
  const created = await page.request.post("/api/companion", { data: command }); expect(created.ok()).toBe(true);
  const { id } = await created.json();
  await page.request.post("/api/account", { data: { action: "demo-person", memberId: target.id } });
  expect((await page.request.post("/api/companion", { data: { action: "ritual-run", id } })).status()).toBe(404);
  const other: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(other.rituals.rituals).toHaveLength(0);
});

test("live Hermes learns a routine, prepares a call and delivers only an approved reply", async ({ page }) => {
  test.skip(process.env.TOGETHERLY_HERMES_BROWSER_LIVE !== "true", "Opt-in: uses real Nebius inference with a synthetic demo family.");
  test.setTimeout(600000);
  const data = await family(page);
  const recipient = data.members.find(m => m.name === "Meera")!;
  await page.goto("/rituals");
  await page.getByRole("button", { name: "New ritual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Who is this time for?").selectOption(recipient.id);
  await dialog.getByLabel("Prepare with").selectOption("hermes");
  await dialog.getByRole("group", { name: /Memories I allow/ }).getByRole("checkbox").first().check();
  await dialog.getByLabel("Offer a reply for my approval").check();
  await dialog.getByRole("button", { name: "Save ritual" }).click();
  await page.getByLabel("Make this routine yours").fill("At most two memories and one question. Simple language and newer contributions first.");
  await page.getByRole("button", { name: "Suggest changes" }).click();
  await expect(page.getByRole("heading", { name: "Your proposed routine" })).toBeVisible({ timeout: 300000 });
  await page.screenshot({ path: "test-results/hermes-skill-review.png", fullPage: true });
  await page.getByRole("button", { name: "Approve routine" }).click();
  await page.getByRole("button", { name: "Prepare now" }).click();
  await expect(page.getByText("Prepared with Hermes + Nemotron", { exact: true })).toBeVisible({ timeout: 300000 });
  const companion: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(companion.rituals.rituals[0].preferences.questionCount).toBe(1);
  const prepared = companion.rituals.runs.find(r => r.result)!;
  expect(prepared.receipt.map(t => t.tool)).toContain("get_approved_updates");
  expect(prepared.result!.moments.filter(m => m.question).every(m => m.question.includes(recipient.name))).toBe(true);
  await page.getByText("Preparation record", { exact: true }).click();
  await expect.poll(() => page.locator(".ritual-moment img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/hermes-prepared.png", fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/hermes-prepared-${width}.png`, fullPage: true });
  }
  await page.getByLabel("A reply to Meera").fill("Meera, I would love to hear more about this memory.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve and send" }).click();
  await expect(page.getByText("Sent to Meera's Togetherly inbox.", { exact: false })).toBeVisible();
  await page.request.post("/api/account", { data: { action: "demo-person", memberId: recipient.id } });
  const recipientData: Snapshot = await (await page.request.get("/api/family")).json();
  expect(recipientData.messages.filter(m => m.text === "Meera, I would love to hear more about this memory.")).toHaveLength(1);
});
