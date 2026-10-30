import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.NEBIUS_API_KEY) {
  console.error("Set NEBIUS_API_KEY in .env.local.");
  process.exit(1);
}

try {
  const response = await fetch("https://api.tokenfactory.nebius.com/v1/models?verbose=true", {
    headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const { data } = await response.json();
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    count: data.length,
    models: data.map((model) => ({
      id: model.id,
      context: model.context_length,
      inputPerMillion: Number(model.pricing?.prompt) * 1_000_000,
      outputPerMillion: Number(model.pricing?.completion) * 1_000_000,
      features: model.supported_features ?? [],
    })),
  }, null, 2));
} catch {
  console.error("Unable to fetch the model catalog. Check connectivity, key and account access.");
  process.exitCode = 1;
}
