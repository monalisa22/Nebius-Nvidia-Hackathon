import { describe, expect, it } from "vitest";
import { buildMoments } from "../lib/anubandh/moments";
import type { Memory } from "../lib/anubandh/types";

function memory(id: string, changes: Partial<Memory> = {}): Memory {
  return {
    id,
    family_id: "family",
    author_id: "author",
    title: "A family update",
    caption: "Original known details",
    kind: "story",
    person_ids: "[]",
    audience: "[]",
    status: "approved",
    media_id: null,
    expires_at: null,
    revision: 1,
    created_at: 100,
    updated_at: 100,
    ...changes,
  };
}
describe("Memory collections", () => {
  it("never includes pending, rejected, or expired memories", () => {
    const moments = buildMoments(
      [
        memory("approved"),
        memory("pending", { status: "pending" }),
        memory("rejected", { status: "rejected" }),
        memory("expired", { expires_at: 200 }),
      ],
      200,
    );
    expect(moments.flatMap((m) => m.memories.map((s) => s.id))).toEqual([
      "approved",
      "approved",
    ]);
  });
  it("does not create empty collections or invent photo dates", () => {
    expect(buildMoments([], 200)).toEqual([]);
    const photo = memory("photo", { kind: "photo", media_id: "image" });
    const moments = buildMoments([photo], 200);
    expect(moments.map((m) => m.title)).toEqual([
      "Little moments",
      "Through the lens",
    ]);
    expect(moments[0].memories[0]).toBe(photo);
  });
  it("limits collections and preserves original source details", () => {
    const sources = Array.from({ length: 12 }, (_, index) =>
      memory(String(index)),
    );
    const moments = buildMoments(sources, 200);
    expect(moments.every((m) => m.memories.length <= 8)).toBe(true);
    expect(moments[0].memories[0].caption).toBe("Original known details");
    expect(sources).toHaveLength(12);
  });
  it("separates stories and original voice recordings", () => {
    const moments = buildMoments(
      [
        memory("story"),
        memory("voice", { kind: "voice", media_id: "recording" }),
      ],
      200,
    );
    expect(
      moments.find((m) => m.id === "voices")?.memories.map((m) => m.id),
    ).toEqual(["voice"]);
    expect(
      moments.find((m) => m.id === "stories")?.memories.map((m) => m.id),
    ).toEqual(["story"]);
  });
});
