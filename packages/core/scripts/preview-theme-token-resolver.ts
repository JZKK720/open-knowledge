import { readFileSync } from 'node:fs';
import { wcagContrast as culoriWcagContrast } from 'culori';
import { findBlockBodies } from './chrome-resolver.ts';

export const PREVIEW_TOKEN_NAMES = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--primary',
  '--primary-foreground',
  '--foreground',
  '--background',
  '--card',
  '--card-foreground',
  '--muted-foreground',
  '--border',
  '--destructive',
  '--radius',
] as const;

export type PreviewTokenName = (typeof PREVIEW_TOKEN_NAMES)[number];

export interface ResolvedPreviewToken {
  name: PreviewTokenName;
  light: string;
  dark: string;
}

const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;

function parseDecls(body: string): Map<string, string> {
  const withoutComments = body.replace(CSS_COMMENT_RE, '');
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null = re.exec(withoutComments);
  while (m !== null) {
    map.set(m[1], m[2].trim().replace(/\s+/g, ' '));
    m = re.exec(withoutComments);
  }
  return map;
}

function mergeDecls(bodies: string[]): Map<string, string> {
  const merged = new Map<string, string>();
  for (const body of bodies) {
    for (const [k, v] of parseDecls(body)) merged.set(k, v);
  }
  return merged;
}

const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g;

function resolveVars(
  value: string,
  lookup: (name: string) => string | undefined,
  depth = 0,
): string {
  if (depth > 16) {
    throw new Error(
      `preview-theme-token-resolver: var() resolution exceeded depth 16 on "${value}"`,
    );
  }
  if (!value.includes('var(')) return value.trim();
  const replaced = value.replace(VAR_RE, (_match, name: string, fallback?: string) => {
    const resolved = lookup(name);
    if (resolved !== undefined) return resolveVars(resolved, lookup, depth + 1);
    if (fallback !== undefined && fallback.trim() !== '') {
      return resolveVars(fallback, lookup, depth + 1);
    }
    throw new Error(`preview-theme-token-resolver: unresolved var(${name}) with no fallback`);
  });
  if (replaced.includes('var(')) {
    throw new Error(
      `preview-theme-token-resolver: could not flatten a var() shape in "${value}" (nested fallback?)`,
    );
  }
  return replaced.trim();
}

export function resolvePreviewThemeTokensFromCss(cssPath: string): ResolvedPreviewToken[] {
  const css = readFileSync(cssPath, 'utf8');
  const rootDecls = mergeDecls(findBlockBodies(css, ':root'));
  const darkDecls = mergeDecls(findBlockBodies(css, '.dark'));
  const themeDecls = mergeDecls(findBlockBodies(css, '@theme'));
  if (rootDecls.size === 0) {
    throw new Error('preview-theme-token-resolver: no :root block found in globals.css');
  }
  if (darkDecls.size === 0) {
    throw new Error('preview-theme-token-resolver: no .dark block found in globals.css');
  }

  const lightLookup = (n: string): string | undefined => rootDecls.get(n) ?? themeDecls.get(n);
  const darkLookup = (n: string): string | undefined =>
    darkDecls.get(n) ?? rootDecls.get(n) ?? themeDecls.get(n);

  return PREVIEW_TOKEN_NAMES.map((name) => {
    const rawLight = rootDecls.get(name);
    if (rawLight === undefined) {
      throw new Error(`preview-theme-token-resolver: ${name} not declared in any :root block`);
    }
    const rawDark = darkDecls.get(name) ?? rawLight;
    return {
      name,
      light: resolveVars(rawLight, lightLookup),
      dark: resolveVars(rawDark, darkLookup),
    };
  });
}

export function renderPreviewThemeTokensModule(tokens: ResolvedPreviewToken[]): string {
  const entries = tokens
    .map((t) => `  { name: '${t.name}', light: '${t.light}', dark: '${t.dark}' },`)
    .join('\n');
  return `/**
 * Preview-iframe theme tokens — the design-token subset injected into every
 * \`html preview\` iframe's \`srcDoc\` as CSS custom properties, so embedded
 * content can reference \`var(--chart-1)\`, \`var(--foreground)\`, … and track
 * the reader's light/dark theme.
 *
 * GENERATED FILE — do not hand-edit. Regenerate after changing any listed
 * token in \`packages/app/src/globals.css\`:
 *
 *     bun run packages/core/scripts/generate-preview-theme-tokens.ts
 *
 * Drift between this file and the CSS is caught by
 * \`preview-theme-tokens.test.ts\` (re-resolves from globals.css).
 */

export interface PreviewThemeToken {
  readonly name: string;
  readonly light: string;
  readonly dark: string;
}

export const PREVIEW_THEME_TOKENS: readonly PreviewThemeToken[] = [
${entries}
];
`;
}

export function wcagContrast(colorA: string, colorB: string): number {
  return culoriWcagContrast(colorA, colorB);
}
