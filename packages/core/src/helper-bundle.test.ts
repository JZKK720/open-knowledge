import { describe, expect, test } from 'bun:test';
import {
  HELPER_BUNDLE_NAME,
  HELPER_EXECUTABLE_NAME,
  resolveHelperBundleBinary,
} from './helper-bundle.ts';

const PARENT_APP = '/Applications/Open Knowledge.app';
const PARENT_EXEC = `${PARENT_APP}/Contents/MacOS/Open Knowledge`;
const HELPER_BINARY = `${PARENT_APP}/Contents/Frameworks/${HELPER_BUNDLE_NAME}/Contents/MacOS/${HELPER_EXECUTABLE_NAME}`;

describe('resolveHelperBundleBinary', () => {
  test('joins the helper-bundle path relative to the parent .app/Contents/MacOS', () => {
    expect(resolveHelperBundleBinary(PARENT_EXEC)).toBe(HELPER_BINARY);
  });

  test('handles a user-Applications path identically', () => {
    const userParent = '/Users/alex/Applications/Open Knowledge.app/Contents/MacOS/Open Knowledge';
    expect(resolveHelperBundleBinary(userParent)).toBe(
      `/Users/alex/Applications/Open Knowledge.app/Contents/Frameworks/${HELPER_BUNDLE_NAME}/Contents/MacOS/${HELPER_EXECUTABLE_NAME}`,
    );
  });
});
