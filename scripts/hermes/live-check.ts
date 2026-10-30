import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { FamilyStore } from "../../lib/anubandh/store";
import { RitualService } from "../../lib/togetherly/ritual-service";
import { prepareWithHermes } from "../../lib/togetherly/hermes";
import { callSkillSchema, ritualResultSchema } from "../../lib/togetherly/ritual-contracts";

loadEnvConfig(process.cwd());
process.env.TOGETHERLY_HERMES_ENABLED = "true";
async function main() {
  const store = new FamilyStore(":memory:");
  try {
    const owner = store.createFamily({ name: "Asha", familyName: "Synthetic Hermes test", email: "asha@example.test", password: "synthetic-test-password" });
    const daughter = store.join(store.invite(owner, { name: "Meera", relationship: "Daughter", view: true, contribute: true, schedule: true }), "meera@example.test", "synthetic-test-password");
    const sourceId = store.addMemory(daughter, { title: "My first song", caption: "I played my first full song on guitar. I played Here Comes the Sun.", kind: "story", personIds: [daughter.person_id!], audience: ["*"] });
    store.reviewMemory(owner, sourceId, "approved", 1);
    store.settings(owner, { language: "en", timezone: "Asia/Kolkata", hour: 8, cloud: true });
    const service = new RitualService(store);
    const id = service.command(owner, { action: "ritual-save", skill: "call", engine: "hermes", recipientId: daughter.id, sourceIds: [sourceId], cadence: "manual", allowAction: true, expiresAt: null }).id as string;
    service.command(owner, { action: "ritual-learn", id, instruction: "Please use at most two memories and just one question. Keep the language simple. Prefer newer contributions." });
    const learning = service.claim()!;
    const learned = await prepareWithHermes(service, learning);
    const preferences = callSkillSchema.parse(learned.content);
    assert.equal(preferences.maxMoments, 2); assert.equal(preferences.questionCount, 1); assert.equal(preferences.focus, "recent");
    assert(service.commit(learning, learned.content, learned.provider, learned.model, learned.receipt));
    assert.equal(service.snapshot(owner).rituals[0].preferences.maxMoments, 3);
    service.command(owner, { action: "ritual-skill-approve", id: learning.id });
    assert.equal(service.snapshot(owner).rituals[0].preferences.maxMoments, 2);
    console.log(JSON.stringify({ check: "real-hermes-learning", provider: learned.provider, model: learned.model, apiCalls: learned.apiCalls, durationMs: learned.durationMs, preferences, tools: learned.receipt.map(t => t.tool) }));
    service.command(owner, { action: "ritual-run", id }); const job = service.claim()!;
    const prepared = await prepareWithHermes(service, job);
    const content = ritualResultSchema.parse(prepared.content);
    assert(content.moments.every(m => m.sourceId === sourceId));
    assert(service.commit(job, prepared.content, prepared.provider, prepared.model, prepared.receipt));
    assert.equal(store.messages(daughter).length, 0);
    assert.equal(content.proposal.tool, "reply.offer");
    const command = { action: "ritual-approve", id: job.id, text: content.proposal.text };
    service.command(owner, command); service.command(owner, command);
    assert.equal(store.messages(daughter).length, 1);
    store.deleteMemory(owner, sourceId);
    assert.equal(service.snapshot(owner).runs.find(r => r.id === job.id)?.result, null);
    console.log(JSON.stringify({ check: "real-hermes-call-and-delivery", provider: prepared.provider, model: prepared.model, apiCalls: prepared.apiCalls, durationMs: prepared.durationMs,
      tools: prepared.receipt.map(t => t.tool), content, duplicateDeliveryPrevented: true, sourceDeletionInvalidates: true }));
  } finally { store.db.close(); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Live check failed"); process.exitCode = 1; });
