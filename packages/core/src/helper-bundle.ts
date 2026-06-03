import { dirname, join } from 'node:path';

export const HELPER_BUNDLE_NAME = 'Open Knowledge Server.app';
export const HELPER_EXECUTABLE_NAME = 'Open Knowledge Helper';

export function resolveHelperBundleBinary(parentExecPath: string): string {
  return join(
    dirname(parentExecPath),
    '..',
    'Frameworks',
    HELPER_BUNDLE_NAME,
    'Contents',
    'MacOS',
    HELPER_EXECUTABLE_NAME,
  );
}
