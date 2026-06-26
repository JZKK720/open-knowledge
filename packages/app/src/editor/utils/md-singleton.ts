import { MarkdownManager, sharedExtensions } from '@inkeep/open-knowledge-core';

let manager: MarkdownManager | null = null;

export function getSharedMarkdownManager(): MarkdownManager {
  manager ||= new MarkdownManager({ extensions: sharedExtensions });
  return manager;
}
