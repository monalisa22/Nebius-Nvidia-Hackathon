import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import { describePhoto } from "../lib/togetherly/photo-ai";
import { isDomainError } from "../lib/anubandh/store";

async function main() {
  if (!process.argv.includes("--live")) { console.log("Use --live for one request using public/demo/garden.jpg, never the family vault."); return; }
  loadEnvConfig(process.cwd());
  process.env.AI_PROVIDER = "token-factory";
  const fetcher = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (...args) => {
    if (++requests > 1) throw new Error("One-request diagnostic limit reached.");
    const response = await fetcher(...args);
    const body = await response.clone().json().catch(() => null);
    console.log(JSON.stringify({ status: response.status, model: body?.model, usage: body?.usage, finishReason: body?.choices?.[0]?.finish_reason,
      toolCalls: body?.choices?.[0]?.message?.tool_calls }));
    return response;
  };
  try {
    const result = await describePhoto(fs.readFileSync("public/demo/garden.jpg"), "A sample photograph for testing. No personal story supplied.", "en");
    console.log(JSON.stringify({ validated: true, ...result }));
  } catch (error) { console.log(JSON.stringify({ validated: false, error: isDomainError(error) ? error.message : "Diagnostic failed." })); process.exitCode = 1; }
  finally { globalThis.fetch = fetcher; }
}
void main();
