import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { workOnce } = await import("../lib/anubandh/worker");
  const { cleanOrphanMedia } = await import("../lib/anubandh/media");
  let stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  console.log("Anubandh worker started. No microphone or camera monitoring.");
  let cycles = 0;
  do {
    try {
      await workOnce();
      if (cycles++ % 60 === 0) cleanOrphanMedia();
    } catch {
      console.error(
        "Worker cycle failed; retrying without exposing private details.",
      );
    }
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } while (!stopping);
}
void main();
