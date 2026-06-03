import type { Config } from '@inkeep/open-knowledge-core';
import { PREVIEW_THEME_TOKENS } from '@inkeep/open-knowledge-core';

export type PreviewScriptSrcPolicy = Config['preview']['scriptSrc'];

export type PreviewTheme = 'light' | 'dark';

const PREVIEW_THEME_MESSAGE_KEY = 'okPreviewTheme';

export interface PreviewThemeMessage {
  [PREVIEW_THEME_MESSAGE_KEY]: PreviewTheme;
}

export function buildPreviewThemeMessage(theme: PreviewTheme): PreviewThemeMessage {
  return { [PREVIEW_THEME_MESSAGE_KEY]: theme };
}

const PREVIEW_HEIGHT_MESSAGE_KEY = 'okPreviewHeight';

export function parsePreviewHeightMessage(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const h = (data as Record<string, unknown>)[PREVIEW_HEIGHT_MESSAGE_KEY];
  return typeof h === 'number' && Number.isFinite(h) && h > 0 ? Math.ceil(h) : null;
}

export const PREVIEW_SCRIPT_SRC_CDN_ALLOWLIST = [
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net',
  'https://unpkg.com',
  'https://esm.sh',
] as const;

const PREVIEW_SCROLLBAR_STYLE = `<style>
  html, body { scrollbar-width: thin; scrollbar-color: rgba(115,115,115,0.4) transparent; }
  html::-webkit-scrollbar, body::-webkit-scrollbar,
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  html::-webkit-scrollbar-track, body::-webkit-scrollbar-track,
  *::-webkit-scrollbar-track { background: transparent; }
  html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb,
  *::-webkit-scrollbar-thumb { background: rgba(115,115,115,0.4); border-radius: 4px; }
  html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover,
  *::-webkit-scrollbar-thumb:hover { background: rgba(115,115,115,0.6); }
</style>`;

function themeDecls(theme: PreviewTheme): string {
  return PREVIEW_THEME_TOKENS.map((t) => `${t.name}:${t[theme]}`).join(';');
}

function themeTokenStyle(): string {
  return `<style>
:root{${themeDecls('light')};color-scheme:light}
:root.dark{${themeDecls('dark')};color-scheme:dark}
body{background:var(--background);color:var(--foreground)}
</style>`;
}

function previewBootstrapScript(theme: PreviewTheme): string {
  const initialClass = theme === 'dark' ? "d.classList.add('dark');" : '';
  return (
    `<script>(function(){` +
    `var d=document.documentElement;${initialClass}` +
    `addEventListener('message',function(e){` +
    `if(e.source!==parent)return;` +
    `var t=e&&e.data&&e.data.${PREVIEW_THEME_MESSAGE_KEY};` +
    `if(t==='dark'){d.classList.add('dark');}` +
    `else if(t==='light'){d.classList.remove('dark');}` +
    `});` +
    `var raf;` +
    `function report(){` +
    `var b=document.body;if(!b)return;` +
    `var r=b.getBoundingClientRect();` +
    `var mb=parseFloat(getComputedStyle(b).marginBottom)||0;` +
    `parent.postMessage({${PREVIEW_HEIGHT_MESSAGE_KEY}:Math.ceil(r.bottom+mb)},'*');` +
    `}` +
    `function schedule(){if(raf){cancelAnimationFrame(raf);}raf=requestAnimationFrame(report);}` +
    `function init(){` +
    `schedule();addEventListener('load',schedule);` +
    `if(window.ResizeObserver){try{new ResizeObserver(schedule).observe(document.body);}catch(_e){}}` +
    `}` +
    `if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}` +
    `else{init();}` +
    `})();</script>`
  );
}

function scriptSrcDirective(policy: PreviewScriptSrcPolicy): string {
  switch (policy) {
    case 'cdn-allowlist':
      return `script-src 'unsafe-inline' ${PREVIEW_SCRIPT_SRC_CDN_ALLOWLIST.join(' ')}`;
    case 'inline-only':
      return "script-src 'unsafe-inline'";
    default: {
      const _exhaustive: never = policy;
      throw new Error(
        `Unhandled preview script-src policy: ${JSON.stringify(_exhaustive as unknown)}`,
      );
    }
  }
}

export function buildPreviewIframeHeader(
  policy: PreviewScriptSrcPolicy,
  theme: PreviewTheme,
): string {
  const csp = `default-src 'none'; ${scriptSrcDirective(policy)}; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none';`;
  return `<meta http-equiv="Content-Security-Policy" content="${csp}">
${themeTokenStyle()}
${PREVIEW_SCROLLBAR_STYLE}
${previewBootstrapScript(theme)}`;
}
