export type EditorId = 'claude' | 'claude-desktop' | 'cursor' | 'codex' | 'opencode';

export const ALL_EDITOR_IDS = [
  'claude',
  'claude-desktop',
  'cursor',
  'codex',
  'opencode',
] as const satisfies readonly EditorId[];

export const EDITOR_LABELS = {
  claude: 'Claude',
  'claude-desktop': 'Claude Desktop',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
} as const satisfies Record<EditorId, string>;
