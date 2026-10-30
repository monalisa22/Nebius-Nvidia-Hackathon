import { loadEnvConfig } from "@next/env";
import { FamilyStore, isDomainError } from "../lib/anubandh/store";
import { generateBrief, aiStatus } from "../lib/anubandh/ai";
import { CompanionService } from "../lib/togetherly/service";
import { extractFamilyDetails } from "../lib/togetherly/ai";
import { RitualService } from "../lib/togetherly/ritual-service";
import { prepareRitual } from "../lib/togetherly/ritual-ai";
import type { ExtractionJob } from "../lib/togetherly/contracts";
import type { Ritual } from "../lib/togetherly/ritual-contracts";

// Synthetic-only diagnostic: no access to the family vault or uploaded media.
async function main() {
  loadEnvConfig(process.cwd());
  const task = process.argv.find(a => a.startsWith("--task="))?.slice(7);
  if (!process.argv.includes("--live") || !["extract", "brief", "ritual"].includes(task ?? "")) {
    console.log("Usage: tsx scripts/check-family-ai.ts --live --task=extract|brief|ritual");
    return;
  }
  if (!aiStatus().configured || aiStatus().mode !== "token-factory") throw new Error("Live Nebius configuration is required.");
  const store = new FamilyStore(":memory:");
  const db = store.db;
  const owner = store.createFamily({ name: "Monalisa", familyName: "Synthetic AI check", email: "parent@example.test", password: "synthetic-check-password" });
  const relative = store.join(store.invite(owner, { name: "Ruhi", relationship: "Daughter", view: true, contribute: true, schedule: true }), "ruhi@example.test", "synthetic-check-password");
  const caption = "A few months ago, I picked up a guitar for the first time. Holding the chords correctly felt difficult.\n\nI practiced a little every day, replaying tutorials and trying again. Today, I played my first full song from start to finish. Hearing a melody come from the guitar felt amazing. I want to learn more songs.";
  const sourceId = store.addMemory(relative, { title: "My first guitar song", caption, kind: "story", personIds: [relative.person_id!], audience: ["*"] });
  store.reviewMemory(owner, sourceId, "approved", 1);
  store.settings(owner, { language: "en", timezone: "UTC", hour: 8, cloud: true });
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (...args) => {
    if (++requests > 1) throw new Error("Diagnostic request limit reached.");
    const response = await originalFetch(...args);
    const body = await response.clone().json().catch(() => null);
    console.log(JSON.stringify({ httpStatus: response.status, model: body?.model,
      finishReason: body?.choices?.[0]?.finish_reason, usage: body?.usage,
      toolCalls: body?.choices?.[0]?.message?.tool_calls?.length ?? 0 }));
    if (process.argv.includes("--show-synthetic-output"))
      console.log(body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "No function arguments");
    return response;
  };
  try {
    let result;
    if (task === "extract") {
      const service = new CompanionService(store);
      service.command(owner, { action: "extract", sourceId });
      const job = service.claimExtraction() as ExtractionJob;
      const context = service.extractionContext(job);
      result = await extractFamilyDetails(context);
      for (const fact of result.content.facts) {
        if (!context.people.some(p => p.id === fact.personId) || !context.source.caption.includes(fact.quote))
          throw new Error("Extraction evidence or person did not match.");
      }
      service.commitExtraction(job, context.fingerprint, result.content, result.provider, result.model);
      console.log(JSON.stringify({ suggestions: result.content.facts.length, persisted: service.facts(owner).length }));
    } else if (task === "brief") {
      store.queue(owner, "briefing", null);
      const job = store.claimJob()!;
      const context = store.context(job);
      result = await generateBrief(context);
      store.commitJob(job, context.fingerprint, result.content, result.provider, result.model);
      console.log(JSON.stringify({ captions: result.content.items.map(i => i.text), persisted: store.artifacts(owner).length }));
    } else {
      const service = new RitualService(store);
      const ritualId = service.command(owner, { action: "ritual-save", skill: "reconnect", recipientId: relative.id, sourceIds: [sourceId], cadence: "manual", allowAction: true, expiresAt: null, engine: "direct" }).id as string;
      service.command(owner, { action: "ritual-run", id: ritualId });
      const job = service.claim()!;
      const ritual = db.prepare("SELECT * FROM connection_rituals WHERE id=?").get(ritualId) as Ritual;
      result = await prepareRitual(service.context(ritual).packet);
      service.commit(job, result.content, result.provider, result.model);
      console.log(JSON.stringify({ persisted: service.snapshot(owner).runs[0]?.status, sentMessages: store.messages(relative).length }));
    }
    console.log(JSON.stringify({ task, validated: true, provider: result.provider, model: result.model }));
  } catch (error) {
    console.error(JSON.stringify({ task, validated: false,
      error: isDomainError(error) ? error.message : "Diagnostic failed; no data was changed." }));
    process.exitCode = 1;
  } finally { globalThis.fetch = originalFetch; db.close(); }
}
void main();
