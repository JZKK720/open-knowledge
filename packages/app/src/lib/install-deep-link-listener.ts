
import { toast } from 'sonner';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';

interface InstallDeepLinkListenerOptions {
  bridge: OkDesktopBridge | undefined;
  setHash?: (hash: string) => void;
  emitToast?: (message: string, opts: { description: string; duration: number }) => void;
}

function encodeDocForHash(doc: string, branch?: string | null): string {
  const base = `#/${encodeURIComponent(doc)}`;
  if (branch === undefined || branch === null || branch === '') return base;
  return `${base}?branch=${encodeURIComponent(branch)}`;
}

export function deriveShareReceiveToast(
  evt: { doc: string; branch?: string | null; multiCandidate?: boolean },
  projectPath: string,
): { message: string; description: string } | null {
  if (evt.branch === undefined || evt.branch === null || evt.branch === '') return null;
  if (projectPath === '') return null;
  if (evt.multiCandidate !== true) return null;
  return {
    message: `Opened on branch ${evt.branch}`,
    description: projectPath,
  };
}

export function installDeepLinkListener(
  opts: InstallDeepLinkListenerOptions,
): (() => void) | undefined {
  const bridge = opts.bridge;
  if (!bridge) return undefined;

  const setHash =
    opts.setHash ??
    ((hash: string) => {
      window.location.hash = hash;
    });
  const emitToast =
    opts.emitToast ??
    ((message: string, toastOpts: { description: string; duration: number }) => {
      toast(message, toastOpts);
    });
  return bridge.onDeepLink((evt) => {
    setHash(encodeDocForHash(evt.doc, evt.branch));
    const payload = deriveShareReceiveToast(evt, bridge.config.projectPath);
    if (payload !== null) {
      emitToast(payload.message, { description: payload.description, duration: 3000 });
    }
  });
}
