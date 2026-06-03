export interface BootRestoreInput {
  pendingRestore: string[] | null;
  lastOpenedProject: string | null;
  optionHeld: boolean;
  pathExists: (p: string) => boolean;
}

export type BootRestoreDecision =
  | { clearSnapshot: boolean; action: 'restore'; projects: string[] }
  | { clearSnapshot: boolean; action: 'lastOpened'; project: string }
  | { clearSnapshot: boolean; action: 'navigator' };

export function bootRestoreDecision(input: BootRestoreInput): BootRestoreDecision {
  const { pendingRestore, lastOpenedProject, optionHeld, pathExists } = input;
  const clearSnapshot = pendingRestore !== null;
  const restorable =
    pendingRestore !== null && !optionHeld ? pendingRestore.filter(pathExists) : [];

  if (restorable.length > 0) {
    return { clearSnapshot, action: 'restore', projects: restorable };
  }
  if (
    pendingRestore === null &&
    lastOpenedProject !== null &&
    !optionHeld &&
    pathExists(lastOpenedProject)
  ) {
    return { clearSnapshot, action: 'lastOpened', project: lastOpenedProject };
  }
  return { clearSnapshot, action: 'navigator' };
}
