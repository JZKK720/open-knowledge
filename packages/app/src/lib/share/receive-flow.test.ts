import { describe, expect, test } from 'bun:test';

import type {
  OkShareReceivedPayload,
  ShareFolderValidationResult,
} from '@/lib/desktop-bridge-types';

import {
  buildCloneUrl,
  formatReceiveLog,
  mapValidationToToast,
  presentReceiveError,
} from './receive-flow';

describe('buildCloneUrl', () => {
  test('matches the canonical .git form (the clone wizard accepts both forms equally)', () => {
    expect(buildCloneUrl({ owner: 'inkeep', repo: 'open-knowledge' })).toBe(
      'https://github.com/inkeep/open-knowledge.git',
    );
  });
});

describe('mapValidationToToast', () => {
  const expected = { owner: 'inkeep', repo: 'open-knowledge' };

  function withKind<K extends ShareFolderValidationResult['kind']>(
    kind: K,
    extras: Partial<ShareFolderValidationResult> = {},
  ): ShareFolderValidationResult {
    if (kind === 'ok') {
      return { kind: 'ok', gitRemoteUrl: 'https://github.com/inkeep/open-knowledge.git' };
    }
    if (kind === 'wrong-repo') {
      return {
        kind: 'wrong-repo',
        actualOwner: extras && 'actualOwner' in extras ? (extras.actualOwner ?? 'a') : 'a',
        actualRepo: extras && 'actualRepo' in extras ? (extras.actualRepo ?? 'b') : 'b',
      };
    }
    return { kind } as ShareFolderValidationResult;
  }

  test('returns null on ok (no toast — caller proceeds)', () => {
    expect(mapValidationToToast(withKind('ok'), expected)).toBeNull();
  });

  test('not-git surfaces the not-a-git-repo prompt', () => {
    expect(mapValidationToToast(withKind('not-git'), expected)).toBe(
      "This folder doesn't contain a git repository. Pick a different folder?",
    );
  });

  test('wrong-repo surfaces the actual vs expected owner/repo per the spec AC', () => {
    const result = withKind('wrong-repo', { actualOwner: 'forky', actualRepo: 'spoon' });
    expect(mapValidationToToast(result, expected)).toBe(
      'This folder is a clone of forky/spoon, not inkeep/open-knowledge. Pick a different folder?',
    );
  });

  test('non-github + symlink-escape + no-origin all surface the wrong-repo generic prompt (Q-A9 v1 simplification)', () => {
    expect(mapValidationToToast(withKind('non-github'), expected)).toBe(
      "This folder isn't a clone of inkeep/open-knowledge. Pick a different folder?",
    );
    expect(mapValidationToToast(withKind('symlink-escape'), expected)).toBe(
      "This folder isn't a clone of inkeep/open-knowledge. Pick a different folder?",
    );
    expect(mapValidationToToast(withKind('no-origin'), expected)).toBe(
      "This folder isn't a clone of inkeep/open-knowledge. Pick a different folder?",
    );
  });
});

describe('presentReceiveError', () => {
  test('launcher-miss payload returns null (caller proceeds to the Q2 surface)', () => {
    const payload: OkShareReceivedPayload = {
      kind: 'launcher-miss',
      share: {
        owner: 'a',
        repo: 'b',
        branch: 'main',
        path: 'README.md',
        blobUrl: 'https://github.com/a/b/blob/main/README.md',
      },
    };
    expect(presentReceiveError(payload)).toBeNull();
  });

  test('launcher-consent payload returns null (caller proceeds to the consent surface)', () => {
    const payload: OkShareReceivedPayload = {
      kind: 'launcher-consent',
      share: {
        owner: 'a',
        repo: 'b',
        branch: 'feat/x',
        path: 'README.md',
        blobUrl: 'https://github.com/a/b/blob/feat/x/README.md',
      },
      candidatePath: '/some/worktree',
      parentProjectName: null,
    };
    expect(presentReceiveError(payload)).toBeNull();
  });

  test('unsupported-version payload returns the update prompt', () => {
    expect(presentReceiveError({ kind: 'unsupported-version' })).toEqual({
      kind: 'unsupported-version',
      message: 'Update Open Knowledge to open this share.',
    });
  });

  test('invalid payload returns the invalid prompt', () => {
    expect(presentReceiveError({ kind: 'invalid' })).toEqual({
      kind: 'invalid',
      message: 'Invalid share URL.',
    });
  });
});

describe('formatReceiveLog', () => {
  test('emits the bracket-prefix shape with whichever fields are set', () => {
    expect(formatReceiveLog({ q2_path: 'clone' })).toBe('[receive] q2_path=clone');
    expect(formatReceiveLog({ q2_path: 'local' })).toBe('[receive] q2_path=local');
    expect(formatReceiveLog({ folder_validate: 'wrong-repo' })).toBe(
      '[receive] folder_validate=wrong-repo',
    );
    expect(formatReceiveLog({ q2_path: 'local', folder_validate: 'ok' })).toBe(
      '[receive] q2_path=local folder_validate=ok',
    );
  });

  test('emits just the prefix with no fields', () => {
    expect(formatReceiveLog({})).toBe('[receive]');
  });

  test('emits branch_action and branch fields when set', () => {
    expect(formatReceiveLog({ branch_action: 'fallback', branch: 'feat/foo' })).toBe(
      '[receive] branch_action=fallback branch=feat/foo',
    );
  });

  test('branch_action without branch is still well-formed', () => {
    expect(formatReceiveLog({ branch_action: 'cancel' })).toBe('[receive] branch_action=cancel');
  });

  test('emits branch_dialog_action for the branch-switch dialog telemetry', () => {
    expect(
      formatReceiveLog({ branch_dialog_action: 'branch-switch-complete', branch: 'feat/x' }),
    ).toBe('[receive] branch=feat/x branch_dialog_action=branch-switch-complete');
  });
});
