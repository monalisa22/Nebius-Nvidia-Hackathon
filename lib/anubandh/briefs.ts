import type { Artifact, BriefContent, BriefItem } from "./types";

export function preparedMemory(artifacts: Artifact[], sourceId: string): BriefItem | undefined {
  for (const artifact of artifacts) {
    const content = JSON.parse(artifact.content) as BriefContent;
    const item = content.version === 2 && content.items.find(item => item.sourceId === sourceId);
    if (item) return item;
  }
}
