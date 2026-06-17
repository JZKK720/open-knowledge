import { describe, expect, it } from 'bun:test';
import { buildClaudeLaunchCommand, shellSingleQuote } from './terminal-launch.ts';

describe('shellSingleQuote', () => {
  it('wraps a plain string in single quotes', () => {
    expect(shellSingleQuote('hello world')).toBe("'hello world'");
  });

  it('escapes embedded single quotes with the POSIX close-escape-reopen idiom', () => {
    expect(shellSingleQuote("it's")).toBe("'it'\\''s'");
  });

  it('renders shell metacharacters inert (no expansion possible)', () => {
    for (const payload of [
      '$(rm -rf /)',
      '`whoami`',
      'a; rm -rf /',
      'a && curl evil',
      'a | sh',
      'a > /etc/passwd',
      '$HOME',
      '*.md',
      'line1\nline2',
      'back\\slash',
    ]) {
      const quoted = shellSingleQuote(payload);
      expect(quoted.startsWith("'")).toBe(true);
      expect(quoted.endsWith("'")).toBe(true);
      expect(quoted).toContain(payload);
    }
  });

  it('cannot be broken out of with an injected quote + command', () => {
    const malicious = "'; rm -rf / #";
    const quoted = shellSingleQuote(malicious);
    expect(quoted).toBe("''\\''; rm -rf / #'");
    const interior = quoted.slice(1, -1);
    expect(interior.replace(/'\\''/g, '')).not.toContain("'");
  });
});

describe('buildClaudeLaunchCommand', () => {
  it("produces the fixed `claude '<prompt>'` shape with a trailing CR", () => {
    expect(buildClaudeLaunchCommand("Let's work on `foo.md` using Open Knowledge.")).toBe(
      "claude 'Let'\\''s work on `foo.md` using Open Knowledge.'\r",
    );
  });

  it('keeps an injection payload inert and contained in the single arg', () => {
    const cmd = buildClaudeLaunchCommand("'; rm -rf / #");
    expect(cmd).toBe("claude ''\\''; rm -rf / #'\r");
    expect(cmd.startsWith('claude ')).toBe(true);
    expect(cmd.endsWith('\r')).toBe(true);
  });
});
