import type { Memory } from "./types";

export type Moment = {
  id: string;
  title: string;
  memories: Memory[];
  tone: "rose" | "blue" | "green";
};

// Inputs come from the permission-filtered snapshot. Never group unapproved or expired items.
export function buildMoments(memories: Memory[], now: number): Moment[] {
  const approved = memories.filter(
    (m) => m.status === "approved" && (!m.expires_at || m.expires_at > now),
  );
  if (!approved.length) return [];
  const moments: Moment[] = [
    {
      id: "recent",
      title: "Little moments",
      memories: approved.slice(0, 8),
      tone: "rose",
    },
  ];
  const photos = approved.filter((m) => m.kind === "photo" && m.media_id);
  if (photos.length)
    moments.push({
      id: "photos",
      title: "Through the lens",
      memories: photos.slice().reverse().slice(0, 8),
      tone: "green",
    });
  const stories = approved.filter(
    (m) => m.kind === "story" || m.kind === "update",
  );
  if (stories.length)
    moments.push({
      id: "stories",
      title: "Stories to revisit",
      memories: stories.slice(0, 8),
      tone: "blue",
    });
  const voices = approved.filter((m) => m.kind === "voice" && m.media_id);
  if (voices.length)
    moments.push({
      id: "voices",
      title: "Familiar voices",
      memories: voices.slice(0, 8),
      tone: "green",
    });
  return moments;
}
