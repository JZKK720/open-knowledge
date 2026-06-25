import { spawn as nodeSpawn } from 'node:child_process';
import { resolve } from 'node:path';
import {
  encodeDocName,
  encodeFolderRoute,
  resolveLockDir,
  resolveUiInfo,
} from '@inkeep/open-knowledge-server';
import { Command } from 'commander';
import { createRealDetectDeps, type DetectResult, detectDesktop } from './desktop-dispatch.ts';

export interface OpenOptions {
  folder?: boolean;
  project?: string;
}

export interface OpenDeps {
  detectBundlePath: () => string | null;
  resolveBaseUrl: (projectDir: string) => string | null;
  openTarget: (target: string) => void;
  log: (message: string) => void;
  error: (message: string) => void;
}

export function scrubElectronRunAsNode(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...env };
  delete next.ELECTRON_RUN_AS_NODE;
  return next;
}

export function createRealOpenDeps(
  detect: () => DetectResult = () => detectDesktop(createRealDetectDeps()),
): OpenDeps {
  return {
    detectBundlePath: () => detect().bundlePath ?? null,
    resolveBaseUrl: (projectDir) => resolveUiInfo({ lockDir: resolveLockDir(projectDir) }).baseUrl,
    openTarget: (target) => {
      const child = nodeSpawn('open', [target], {
        detached: true,
        stdio: 'ignore',
        env: scrubElectronRunAsNode(process.env),
      });
      child.unref();
    },
    log: (message) => process.stdout.write(`${message}\n`),
    error: (message) => process.stderr.write(`${message}\n`),
  };
}

export function runOpen(name: string, options: OpenOptions, deps: OpenDeps): number {
  const projectDir = resolve(options.project ?? process.cwd());
  const isFolder = options.folder === true || /\/+$/.test(name);
  const cleanName = name.replace(/\/+$/, '');

  if (!cleanName) {
    deps.error('Nothing to open: pass a doc path (e.g. `ok open specs/foo/SPEC`).');
    return 1;
  }

  if (
    cleanName.startsWith('/') ||
    cleanName.includes('\\') ||
    cleanName.split('/').includes('..')
  ) {
    deps.error(
      `Invalid name "${cleanName}": must be a relative path with no '..' segments, leading '/', or backslashes.`,
    );
    return 1;
  }

  if (isFolder) {
    const baseUrl = deps.resolveBaseUrl(projectDir);
    if (!baseUrl) {
      deps.error(
        `No OpenKnowledge UI is running for ${projectDir}. Folder preview requires a running UI — start one with \`ok ui\`, then retry.`,
      );
      return 1;
    }
    const url = `${baseUrl}/#/${encodeFolderRoute(cleanName)}`;
    deps.openTarget(url);
    deps.log(`Opening folder ${cleanName} in your browser: ${url}`);
    return 0;
  }

  const bundlePath = deps.detectBundlePath();
  if (bundlePath) {
    const deepLink = `openknowledge://open?project=${encodeURIComponent(
      projectDir,
    )}&doc=${encodeURIComponent(cleanName)}`;
    deps.openTarget(deepLink);
    deps.log(`Opening ${cleanName} in the OpenKnowledge desktop app.`);
    return 0;
  }

  const baseUrl = deps.resolveBaseUrl(projectDir);
  if (baseUrl) {
    const url = `${baseUrl}/#/${encodeDocName(cleanName)}`;
    deps.openTarget(url);
    deps.log(`Opening ${cleanName} in your browser: ${url}`);
    return 0;
  }

  deps.error(
    'No OpenKnowledge desktop app found and no UI is running. ' +
      'Install OK Desktop, or start a UI with `ok ui`, then retry.',
  );
  return 1;
}

export function openCommand(): Command {
  return new Command('open')
    .description('Open a doc in the OK Desktop app (folders open in the browser)')
    .argument(
      '<doc>',
      'Extension-less doc path (e.g. specs/foo/SPEC), or a folder path with --folder',
    )
    .option('--folder', 'Treat <doc> as a folder and open the folder route in the browser')
    .option('--project <dir>', 'Project root (defaults to the current directory)')
    .action((name: string, options: OpenOptions) => {
      process.exitCode = runOpen(name, options, createRealOpenDeps());
    });
}
