import type { EditorViewMenuStateSnapshot } from '../shared/ipc-channels';

export function mergeViewMenuState(
  prev: EditorViewMenuStateSnapshot,
  partial: Partial<EditorViewMenuStateSnapshot>,
): EditorViewMenuStateSnapshot {
  return { ...prev, ...partial };
}
