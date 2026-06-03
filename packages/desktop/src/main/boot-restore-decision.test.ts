import { describe, expect, test } from 'bun:test';
import { bootRestoreDecision } from './boot-restore-decision.ts';

function existsIn(paths: string[]): (p: string) => boolean {
  const set = new Set(paths);
  return (p) => set.has(p);
}

describe('bootRestoreDecision', () => {
  test('empty restore snapshot does not fall through to lastOpened', () => {
    const decision = bootRestoreDecision({
      pendingRestore: [],
      lastOpenedProject: '/projects/last',
      optionHeld: false,
      pathExists: existsIn(['/projects/last']),
    });
    expect(decision).toEqual({ clearSnapshot: true, action: 'navigator' });
  });

  test('optionHeld with a non-empty snapshot consumes but suppresses restore', () => {
    const decision = bootRestoreDecision({
      pendingRestore: ['/projects/a', '/projects/b'],
      lastOpenedProject: '/projects/last',
      optionHeld: true,
      pathExists: existsIn(['/projects/a', '/projects/b', '/projects/last']),
    });
    expect(decision).toEqual({ clearSnapshot: true, action: 'navigator' });
  });

  test('non-empty snapshot with all paths existing restores in order', () => {
    const decision = bootRestoreDecision({
      pendingRestore: ['/projects/a', '/projects/b', '/projects/c'],
      lastOpenedProject: null,
      optionHeld: false,
      pathExists: existsIn(['/projects/a', '/projects/b', '/projects/c']),
    });
    expect(decision).toEqual({
      clearSnapshot: true,
      action: 'restore',
      projects: ['/projects/a', '/projects/b', '/projects/c'],
    });
  });

  test('snapshot with some missing paths restores only existing ones', () => {
    const decision = bootRestoreDecision({
      pendingRestore: ['/projects/a', '/projects/gone', '/projects/c'],
      lastOpenedProject: null,
      optionHeld: false,
      pathExists: existsIn(['/projects/a', '/projects/c']),
    });
    expect(decision).toEqual({
      clearSnapshot: true,
      action: 'restore',
      projects: ['/projects/a', '/projects/c'],
    });
  });

  test('snapshot with all paths missing opens the navigator', () => {
    const decision = bootRestoreDecision({
      pendingRestore: ['/projects/gone1', '/projects/gone2'],
      lastOpenedProject: '/projects/last',
      optionHeld: false,
      pathExists: existsIn(['/projects/last']),
    });
    expect(decision).toEqual({ clearSnapshot: true, action: 'navigator' });
  });

  test('null snapshot with a valid lastOpenedProject restores it', () => {
    const decision = bootRestoreDecision({
      pendingRestore: null,
      lastOpenedProject: '/projects/last',
      optionHeld: false,
      pathExists: existsIn(['/projects/last']),
    });
    expect(decision).toEqual({
      clearSnapshot: false,
      action: 'lastOpened',
      project: '/projects/last',
    });
  });

  test('null snapshot with no lastOpenedProject opens the navigator without clearing', () => {
    const decision = bootRestoreDecision({
      pendingRestore: null,
      lastOpenedProject: null,
      optionHeld: false,
      pathExists: existsIn([]),
    });
    expect(decision).toEqual({ clearSnapshot: false, action: 'navigator' });
  });

  test('null snapshot with a missing lastOpenedProject opens the navigator without clearing', () => {
    const decision = bootRestoreDecision({
      pendingRestore: null,
      lastOpenedProject: '/projects/gone',
      optionHeld: false,
      pathExists: existsIn([]),
    });
    expect(decision).toEqual({ clearSnapshot: false, action: 'navigator' });
  });

  test('null snapshot with optionHeld suppresses lastOpened restore', () => {
    const decision = bootRestoreDecision({
      pendingRestore: null,
      lastOpenedProject: '/projects/last',
      optionHeld: true,
      pathExists: existsIn(['/projects/last']),
    });
    expect(decision).toEqual({ clearSnapshot: false, action: 'navigator' });
  });
});
