import { isDomainError } from "../anubandh/store";
import { extractFamilyDetails } from "./ai";
import type { CompanionService } from "./service";

export async function processExtraction(service: CompanionService) {
  const job = service.claimExtraction();
  if (!job) return false;
  try {
    const context = service.extractionContext(job);
    const result = await extractFamilyDetails(context);
    service.commitExtraction(job, context.fingerprint, result.content, result.provider, result.model);
  } catch (error) {
    service.failExtraction(job, isDomainError(error) && error.status === 503,
      isDomainError(error) ? error.message : undefined);
  }
  return true;
}
