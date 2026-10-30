import { isDomainError, getStore, type FamilyStore } from "./store";
import { generateBrief } from "./ai";
import { CompanionService } from "../togetherly/service";
import { processExtraction } from "../togetherly/worker";
import { RitualService } from "../togetherly/ritual-service";
import { processRitual } from "../togetherly/ritual-ai";
import { PhotoService } from "../togetherly/photo-service";
import { processPhoto } from "../togetherly/photo-ai";

export async function workOnce(store: FamilyStore = getStore()) {
  store.tick();
  const companion = new CompanionService(store);
  companion.tick();
  const rituals = new RitualService(store);
  rituals.tick();
  const job = store.claimJob();
  if (!job) return (await processPhoto(new PhotoService(store))) || (await processRitual(rituals)) || processExtraction(companion);
  try {
    const context = store.context(job);
    const result = await generateBrief(context);
    store.commitJob(
      job,
      context.fingerprint,
      result.content,
      result.provider,
      result.model,
    );
  } catch (error) {
    store.failJob(
      job,
      isDomainError(error) ? error.message : "Processing failed. Please retry.",
      isDomainError(error) && error.status === 503,
    );
  }
  return true;
}
