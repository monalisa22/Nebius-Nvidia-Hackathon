import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../lib/anubandh/types";
import type { CompanionSnapshot } from "../../lib/togetherly/service";

test("photo review preserves story details and creates a themed memory walk", async ({ page }) => {
  test.setTimeout(180000);
  expect((await page.request.post("/api/account", { data: { action: "demo" } })).ok()).toBe(true);
  expect((await page.request.post("/api/family", { data: { action: "settings", language: "en", timezone: "UTC", hour: 8, cloud: true } })).ok()).toBe(true);
  const initial: Snapshot = await (await page.request.get("/api/family")).json();
  const memory = initial.memories.find(m => m.kind === "photo" && m.status === "approved")!;
  expect((await page.request.post("/api/companion", { data: { action: "memory-context", sourceId: memory.id, revision: memory.revision, occurredOn: "2024-10-31", place: "Our home", legacy: true } })).ok()).toBe(true);
  await page.goto("/choices");
  await page.getByLabel("Allow AI for photographs we choose").click();
  await expect(page.getByLabel("Allow AI for photographs we choose")).toBeChecked();
  await expect(page.getByText("Photo processing is allowed.")).toBeVisible();
  await page.goto("/memories");
  await page.locator(".memory-card").filter({ hasText: memory.title }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(memory.caption, { exact: true })).toBeVisible();
  await dialog.getByText("Story details", { exact: true }).click();
  await expect(dialog.getByLabel("Place", { exact: true })).toHaveValue("Our home");
  await expect(dialog.getByLabel("When this happened")).toHaveValue("2024-10-31");
  await expect(dialog.getByLabel("Keep in Family stories")).toBeChecked();
  await dialog.getByRole("button", { name: "Explore this photo" }).click();
  await expect(dialog.getByText("Offline preview / not image analysis")).toBeVisible({ timeout: 60000 });
  await dialog.getByLabel("Photo description").fill("Flower garlands and small lamps decorate our home.");
  await dialog.getByLabel("Visible details").fill("A garland hangs beside the doorway.");
  await dialog.getByLabel("A question to share").fill("Which decoration would you enjoy making together again?");
  await dialog.getByLabel("Little everyday moments").uncheck();
  await dialog.getByLabel("Our Diwali memories").check();
  await dialog.getByRole("button", { name: "Keep reviewed details" }).click();
  await expect(dialog.getByRole("button", { name: "Edit photo details" })).toBeVisible();
  await expect(dialog.getByText(memory.caption, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const second = initial.memories.find(m => m.kind === "photo" && m.status === "approved" && m.id !== memory.id)!;
  expect((await page.request.post("/api/companion", { data: { action: "photo-analyze", sourceId: second.id } })).ok()).toBe(true);
  await expect.poll(async () => {
    const snapshot: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
    return snapshot.photos.analyses.find(a => a.sourceId === second.id)?.status;
  }, { timeout: 60000 }).toBe("ready");
  const ready: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  const secondAnalysis = ready.photos.analyses.find(a => a.sourceId === second.id)!;
  expect((await page.request.post("/api/companion", { data: {
    action: "photo-review", id: secondAnalysis.id, revision: secondAnalysis.revision,
    content: { ...secondAnalysis.content, themes: ["diwali"] },
  } })).ok()).toBe(true);
  await page.reload();
  await page.getByRole("textbox", { name: "Find a memory" }).fill("garland");
  await expect(page.locator(".memory-card").filter({ hasText: memory.title })).toBeVisible();
  await page.getByRole("textbox", { name: "Find a memory" }).fill("");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/photo-collections-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: /Our Diwali memories/ }).click();
  await expect(dialog.getByText("Which decoration would you enjoy making together again?")).toBeVisible();
  await expect.poll(() => dialog.locator(".photo-collection-hero").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(dialog.getByText("1 of 2", { exact: true })).toBeVisible();
  const viewer = dialog.getByLabel("Collection photographs");
  await viewer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Previous photograph" }).click();
  await expect(dialog.getByText("1 of 2", { exact: true })).toBeVisible();
  const photo = dialog.locator(".photo-collection-hero");
  await photo.evaluate(target => {
    const start = new Touch({ identifier: 1, target, clientX: 260, clientY: 200 });
    target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
    const end = new Touch({ identifier: 1, target, clientX: 70, clientY: 205 });
    target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
  });
  await expect(dialog.getByText("2 of 2", { exact: true })).toBeVisible();
  await viewer.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/photo-collection-open-320.png", fullPage: true });
  await dialog.getByLabel("Name your walk").fill("Diwali at our home");
  await dialog.getByRole("button", { name: "Create memory walk" }).click();
  await expect(page).toHaveURL(/\/walks$/);
  await page.locator(".walk-card").filter({ hasText: "Diwali at our home" }).getByRole("button", { name: "Resume walk" }).click();
  await expect(page.locator(".walk-narration")).toContainText(memory.caption);
  await expect(page.locator(".walk-photo-prompt")).toHaveText("Which decoration would you enjoy making together again?");
  const after: Snapshot = await (await page.request.get("/api/family")).json();
  expect(after.memories.find(m => m.id === memory.id)?.caption).toBe(memory.caption);
  const details: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(details.memoryContext.find(m => m.source_id === memory.id)).toMatchObject({ place: "Our home", legacy: 1, occurred_on: "2024-10-31" });
  await page.goto("/choices");
  await page.getByLabel("Allow AI for photographs we choose").click();
  await expect(page.getByLabel("Allow AI for photographs we choose")).not.toBeChecked();
  await expect(page.getByText("Photo processing is off.")).toBeVisible();
  const revoked: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(revoked.photos.analyses).toHaveLength(0);
  expect(revoked.photos.collections).toHaveLength(0);
  expect((await page.request.get(`/api/media/${memory.media_id}`)).ok()).toBe(true);
});

test("photo API keeps permission and review private from other family members", async ({ page }) => {
  expect((await page.request.post("/api/account", { data: { action: "demo" } })).ok()).toBe(true);
  const data: Snapshot = await (await page.request.get("/api/family")).json();
  const relative = data.members.find(m => m.role === "relative")!;
  await page.request.post("/api/account", { data: { action: "demo-person", memberId: relative.id } });
  expect((await page.request.post("/api/companion", { data: { action: "photo-permission", enabled: true } })).status()).toBe(403);
});
