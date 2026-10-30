import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../lib/anubandh/types";
import type { CompanionSnapshot } from "../../lib/togetherly/service";

test("companion API authentication, source review, capsule privacy, and export", async ({ page }) => {
  expect((await page.request.get("/api/companion")).status()).toBe(401);
  expect((await page.request.post("/api/account", { data: { action: "demo" } })).ok()).toBe(true);
  const family: Snapshot = await (await page.request.get("/api/family")).json();
  const primaryId = family.member.id;
  const recipient = family.members.find(m => m.role === "relative")!;
  const memory = family.memories.find(m => m.status === "approved" && JSON.parse(m.person_ids).length > 0)!;
  const request = async (data: Record<string, unknown>) => page.request.post("/api/companion", { data });
  const unauthorizedOrigin = await page.request.post("/api/companion", {
    data: { action: "check-in" }, headers: { origin: "https://unrelated.example" },
  });
  expect(unauthorizedOrigin.status()).toBe(403);
  const before: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(before.preferences.checkin_enabled).toBe(0);
  expect(before.preferences.auto_insights).toBe(0);
  const proposed = await request({ action: "fact-propose", sourceId: memory.id,
    fact: { personId: JSON.parse(memory.person_ids)[0], category: "interest", quote: memory.caption } });
  expect(proposed.ok()).toBe(true);
  const { id: factId } = await proposed.json();
  expect((await request({ action: "fact-review", id: factId, decision: "approved" })).ok()).toBe(true);
  const created = await request({ action: "capsule-create", recipientId: recipient.id,
    title: "For later", text: "A private future greeting", deliverAt: Date.now() + 86400000 });
  expect(created.ok()).toBe(true);
  const { id: capsuleId } = await created.json();
  expect((await request({ action: "capsule-approve", id: capsuleId, revision: 1 })).ok()).toBe(true);
  const after: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  const capsule = after.capsules.find(c => c.id === capsuleId)!;
  const earlySend = await page.request.post("/api/family", { data: { action: "reply-send", id: capsule.message_id, revision: 1 } });
  expect(earlySend.status()).toBe(409);
  await page.request.post("/api/account", { data: { action: "demo-person", memberId: recipient.id } });
  const recipientData: CompanionSnapshot = await (await page.request.get("/api/companion")).json();
  expect(recipientData.capsules).toHaveLength(0);
  expect(JSON.stringify(await (await page.request.get("/api/family")).json())).not.toContain("A private future greeting");
  await page.request.post("/api/account", { data: { action: "demo-person", memberId: primaryId } });
  expect((await request({ action: "capsule-cancel", id: capsuleId, revision: 2 })).ok()).toBe(true);
  const exported = await (await page.request.get("/api/export")).json();
  expect(exported.companion.facts.some((f: { id: string }) => f.id === factId)).toBe(true);
  expect(exported.companion.capsules[0].status).toBe("cancelled");
});
