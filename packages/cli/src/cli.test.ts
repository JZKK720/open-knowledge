import { describe, expect, test } from 'bun:test';

const CLI_PACKAGE_ROOT = import.meta.dir.replace(/\/src$/, '');

describe('CLI argv parsing', () => {
  test('uses node argv slicing when launched by Electron as Node', () => {
    const result = Bun.spawnSync({
      cmd: [
        'bun',
        '--conditions=development',
        '-e',
        `
        Object.defineProperty(process.versions, 'electron', {
          value: '35.0.0',
          configurable: true,
        });
        process.argv = [
          process.execPath,
          process.cwd() + '/src/cli.ts',
          'ps',
          '--json',
        ];
        await import('./src/cli.ts');
        `,
      ],
      cwd: CLI_PACKAGE_ROOT,
      env: { ...process.env, NO_COLOR: '1' },
    });

    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stderr).not.toContain('unknown option');
    expect(stdout.startsWith('[')).toBe(true);
  }, 30_000);
});

describe('CLI --version notice', () => {
  test('--version emits the version plus the GPL copyright / free-software / no-warranty trio', () => {
    const result = Bun.spawnSync({
      cmd: [
        'bun',
        '--conditions=development',
        '-e',
        `
        process.argv = [process.execPath, process.cwd() + '/src/cli.ts', '--version'];
        await import('./src/cli.ts');
        `,
      ],
      cwd: CLI_PACKAGE_ROOT,
      env: { ...process.env, NO_COLOR: '1' },
    });

    const stdout = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(stdout).toMatch(/Copyright \(C\) \d{4} Inkeep, Inc\./);
    expect(stdout).toContain('GPL-3.0-or-later');
    expect(stdout).toMatch(/free software/i);
    expect(stdout).toMatch(/NO WARRANTY/);
  }, 30_000);
});
