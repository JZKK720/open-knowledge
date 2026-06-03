import type { HandoffTarget } from './types.ts';

const PATH_INJECTION_SANITIZE_RE = new RegExp(
  '[' +
    '\\u0000-\\u001f' + // ASCII C0 controls
    '\\u007f-\\u009f' + // DEL + ASCII C1 controls
    '\\u200b-\\u200f' + // zero-width + bidi marks
    '\\u2028-\\u202e' + // LINE SEP + PARAGRAPH SEP + bidi overrides (ES line terminators)
    '\\u2060-\\u2069' + // word-joiner + bidi isolates
    '\\ufeff' + // BOM / zero-width no-break space
    '`' + // backtick (terminates the wrapping fence at the call site)
    ']+',
  'g',
);

const AT_MENTION_PATH_INJECTION_SANITIZE_RE = new RegExp(
  '[ \\u00a0' + // ASCII space + no-break space
    '\\u0000-\\u001f' + // ASCII C0 controls
    '\\u007f-\\u009f' + // DEL + ASCII C1 controls
    '\\u200b-\\u200f' + // zero-width + bidi marks
    '\\u2028-\\u202e' + // LINE SEP + PARAGRAPH SEP + bidi overrides
    '\\u2060-\\u2069' + // word-joiner + bidi isolates
    '\\ufeff' + // BOM
    '`' + // backtick
    ']+',
  'g',
);

function sanitizePathForPrompt(path: string): string {
  return path.replace(PATH_INJECTION_SANITIZE_RE, '_');
}

function sanitizePathForAtMention(path: string): string {
  return path.replace(AT_MENTION_PATH_INJECTION_SANITIZE_RE, '_');
}

export function composeFilePrompt(relativePath: string, autoOpen: boolean): string {
  const safe = sanitizePathForPrompt(relativePath);
  const base = `Let's work on \`${safe}\` using Open Knowledge.`;
  return autoOpen ? `${base} Open the OK editor in web view.` : base;
}

export function composeFolderPrompt(relativeFolderPath: string, autoOpen: boolean): string {
  const safe = sanitizePathForPrompt(relativeFolderPath);
  const base = `Let's work on the \`${safe}\` folder using Open Knowledge.`;
  return autoOpen ? `${base} Open the OK editor in web view.` : base;
}

export function composeEmptySpacePrompt(autoOpen: boolean): string {
  const base = `Let's work on this project using Open Knowledge.`;
  return autoOpen ? `${base} Open the OK editor in web view.` : base;
}

const MAX_HANDOFF_URL_LENGTH = 4096;

const URL_OVERHEAD_RESERVE = 1024;

/** Encoded-prompt budget for inline mode; over this the composer falls back
 *  to locus mode. */
const INLINE_PROMPT_ENCODED_BUDGET = MAX_HANDOFF_URL_LENGTH - URL_OVERHEAD_RESERVE;

const LOCUS_ANCHOR_MAX_CHARS = 160;

const MIN_FENCE_LENGTH = 3;

const INSTRUCTION_TRUNCATION_MARKER = ' …';

interface SelectionPromptInput {
  /** Active doc's path relative to the OK content dir, forward-slash
   *  normalized with the `.md` suffix. Sanitized before interpolation. */
  readonly relativePath: string;
  /** What the user wants done with the passage; the empty string when the
   *  user dispatched without typing an instruction. */
  readonly instruction: string;
  readonly selectionMarkdown: string;
  /** Dispatch target — selects the URL encoding. Cursor double-encodes its
   *  prompt param; Claude and Codex single-encode. */
  readonly target: HandoffTarget;
}

function longestBacktickRun(s: string): number {
  let longest = 0;
  let run = 0;
  for (const ch of s) {
    if (ch === '`') {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest;
}

function fenceFor(content: string): string {
  return '`'.repeat(Math.max(longestBacktickRun(content) + 1, MIN_FENCE_LENGTH));
}

function buildLocusAnchor(selectionMarkdown: string): string {
  const trimmed = selectionMarkdown.trimStart();
  const newlineIdx = trimmed.indexOf('\n');
  const lineEnd = newlineIdx === -1 ? trimmed.length : newlineIdx;
  return trimmed.slice(0, Math.min(lineEnd, LOCUS_ANCHOR_MAX_CHARS)).trimEnd();
}

function encodedPromptLength(prompt: string, target: HandoffTarget): number {
  const once = encodeURIComponent(prompt);
  return target === 'cursor' ? encodeURIComponent(once).length : once.length;
}

function selectionLead(safePath: string): string {
  return `Let's work on the selected passage in @${safePath} using Open Knowledge.`;
}

function instructionLines(instruction: string): readonly string[] {
  const trimmed = instruction.trim();
  if (trimmed === '') return [];
  const quoted = trimmed
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return ['Instruction:', '', quoted, ''];
}

function composeInline(safePath: string, instruction: string, selectionMarkdown: string): string {
  const fence = fenceFor(selectionMarkdown);
  return [
    selectionLead(safePath),
    '',
    ...instructionLines(instruction),
    'Here is the passage:',
    '',
    fence,
    selectionMarkdown,
    fence,
  ].join('\n');
}

function composeLocus(safePath: string, instruction: string, selectionMarkdown: string): string {
  const anchor = buildLocusAnchor(selectionMarkdown);
  const fence = fenceFor(anchor);
  return [
    selectionLead(safePath),
    '',
    ...instructionLines(instruction),
    'The passage begins:',
    '',
    fence,
    anchor,
    fence,
    '',
    `Read the full passage from @${safePath} via the Open Knowledge MCP server before editing.`,
  ].join('\n');
}

function fitInstructionForLocus(
  safePath: string,
  instruction: string,
  selectionMarkdown: string,
  target: HandoffTarget,
): string {
  const fits = (instr: string): boolean =>
    encodedPromptLength(composeLocus(safePath, instr, selectionMarkdown), target) <=
    INLINE_PROMPT_ENCODED_BUDGET;
  if (fits(instruction)) return instruction;
  let lo = 0;
  let hi = instruction.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = instruction.slice(0, mid).trimEnd() + INSTRUCTION_TRUNCATION_MARKER;
    if (fits(candidate)) lo = mid;
    else hi = mid - 1;
  }
  const kept = instruction.slice(0, lo).trimEnd();
  return kept === '' ? '' : kept + INSTRUCTION_TRUNCATION_MARKER;
}

export function composeSelectionPrompt(input: SelectionPromptInput): string {
  const safePath = sanitizePathForAtMention(input.relativePath);
  const inline = composeInline(safePath, input.instruction, input.selectionMarkdown);
  if (encodedPromptLength(inline, input.target) <= INLINE_PROMPT_ENCODED_BUDGET) {
    return inline;
  }
  const fittedInstruction = fitInstructionForLocus(
    safePath,
    input.instruction,
    input.selectionMarkdown,
    input.target,
  );
  return composeLocus(safePath, fittedInstruction, input.selectionMarkdown);
}
