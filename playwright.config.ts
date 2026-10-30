import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
if (existsSync(path.resolve(".runtime/browsers")))
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".runtime/browsers");
const libraries = path.resolve(
  ".runtime/browser-libs/usr/lib/x86_64-linux-gnu",
);
if (existsSync(libraries))
  process.env.LD_LIBRARY_PATH = [libraries, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":");
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    actionTimeout: 15000,
    baseURL: process.env.ANUBANDH_TEST_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
