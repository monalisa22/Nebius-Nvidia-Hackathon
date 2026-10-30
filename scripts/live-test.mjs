import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "node_modules/vitest/vitest.mjs", "run", "tests/nebius-live.test.ts", "--reporter=verbose", "--bail=1",
], { stdio: "inherit", env: { ...process.env, OPENLOOP_LIVE_TEST: "1" } });
process.exitCode = result.status ?? 1;
