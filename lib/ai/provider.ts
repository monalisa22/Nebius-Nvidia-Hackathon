import { AiProviderError } from "@/lib/ai/errors";
import { FixturePersonalAiProvider } from "@/lib/ai/fixture-provider";
import { TokenFactoryPersonalAiProvider, tokenFactoryConfigured } from "@/lib/ai/token-factory";

export function providerStatus() {
  const mode = process.env.AI_PROVIDER ?? "fixture";
  return {
    mode,
    configured: mode === "fixture" || (mode === "token-factory" && tokenFactoryConfigured() && /^nvidia\//i.test(process.env.NEBIUS_MODEL ?? "")),
    model: mode === "token-factory" ? process.env.NEBIUS_MODEL || null : null,
  };
}

export function getPersonalAiProvider() {
  const { mode } = providerStatus();
  if (mode === "fixture") return new FixturePersonalAiProvider();
  if (mode === "token-factory") return new TokenFactoryPersonalAiProvider();
  throw new AiProviderError("AI_PROVIDER must be fixture or token-factory. Check .env.local.");
}
