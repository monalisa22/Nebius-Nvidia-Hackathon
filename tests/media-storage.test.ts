import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getStore } from "../lib/anubandh/store";
import { cleanOrphanMedia, storageDirectory } from "../lib/anubandh/media";

vi.mock("../lib/anubandh/store", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/anubandh/store")>(), getStore: vi.fn(),
}));
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "togetherly-storage-test-"));
  vi.stubEnv("ANUBANDH_DATABASE_PATH", undefined);
  vi.stubEnv("ANUBANDH_STORAGE_PATH", undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); rmSync(directory, { recursive: true, force: true }); });

it("retains the normal vault location for the default database", () => {
  expect(storageDirectory()).toBe(path.join(process.cwd(), ".data", "anubandh"));
});
it("refuses implicit shared media storage for an alternate database", () => {
  vi.stubEnv("ANUBANDH_DATABASE_PATH", path.join(directory, "family.db"));
  expect(() => storageDirectory()).toThrow(/explicit, separate ANUBANDH_STORAGE_PATH/);
});
it("uses the explicit storage directory for an alternate database", () => {
  vi.stubEnv("ANUBANDH_DATABASE_PATH", path.join(directory, "family.db"));
  vi.stubEnv("ANUBANDH_STORAGE_PATH", directory);
  expect(storageDirectory()).toBe(directory);
});
it("cleans only known unused records, leaving unrecognized files untouched", () => {
  vi.stubEnv("ANUBANDH_STORAGE_PATH", directory);
  mkdirSync(path.join(directory, "media"));
  for (const name of ["known-unused", "unrecognized-preserve"]) writeFileSync(path.join(directory, "media", name), "synthetic media");
  const run = vi.fn();
  vi.mocked(getStore).mockReturnValue({ all: () => [{ id: "known-unused" }], run } as unknown as ReturnType<typeof getStore>);
  cleanOrphanMedia();
  expect(existsSync(path.join(directory, "media", "known-unused"))).toBe(false);
  expect(existsSync(path.join(directory, "media", "unrecognized-preserve"))).toBe(true);
  expect(run).toHaveBeenCalledWith("DELETE FROM media WHERE id=?", "known-unused");
});
