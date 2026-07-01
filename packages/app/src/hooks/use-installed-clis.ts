import type { TerminalCli } from '@inkeep/open-knowledge-core';
import { useEffect, useState } from 'react';

export function useInstalledClis(): Partial<Record<TerminalCli, boolean>> {
  const [installedClis, setInstalledClis] = useState<Partial<Record<TerminalCli, boolean>>>({});
  useEffect(() => {
    const terminal = window.okDesktop?.terminal;
    if (typeof terminal?.cliInstalledMap !== 'function') return;
    let cancelled = false;
    void terminal
      .cliInstalledMap()
      .then((map) => {
        if (!cancelled) setInstalledClis(map);
      })
      .catch((err) => {
        console.warn('[terminal] cliInstalledMap probe failed; defaulting to none installed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return installedClis;
}
