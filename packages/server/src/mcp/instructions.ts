import type { Config } from '../config/schema.ts';

export function buildInstructions(_content: Config['content']): string {
  return `Open Knowledge is a markdown-CRDT knowledge base exposed via MCP.

## STOP — native tools on in-scope \`.md\` / \`.mdx\`

When this workspace has Open Knowledge MCP configured, do **not** use your host's native file tools on markdown paths inside the content directory. The ban covers every common rationalization:

- **Native \`Read\` / \`Grep\` / \`Glob\` on in-scope \`.md\` / \`.mdx\`** — the original case.
- **\`Bash ls\` / \`Bash find\` / \`Bash cat\` on dirs containing in-scope markdown** — use \`exec("ls -A …")\` / \`exec("find … -name '*.md'")\` / \`exec("cat …")\` instead. Native returns bare names; \`exec\` returns frontmatter, backlink counts, and recent activity per child. \`-A\` shows hidden entries (\`.ok/\`, \`.okignore\`) which OK projects carry; omit \`.\` and \`..\` rows that \`-a\` would add.
- **Glob patterns that target markdown** (\`**/*.md\`, any dir known to be markdown-heavy like \`specs/**\`, \`reports/**\`, \`docs/**\`) — use \`exec\` with \`find\`, or \`exec("ls -A <dir>")\`.
- **Dispatching the Explore / general-purpose subagent for markdown-heavy exploration** — subagents use native \`Read\` / \`Grep\` / \`Glob\` internally and bypass Open Knowledge entirely. Do markdown exploration yourself via \`exec\` / \`search\`. Subagents remain appropriate for **source-code** exploration.
- **Native \`Read\` / \`Grep\` on any in-scope markdown inside \`.ok/\`** — the \`.ok/\` directory is in-scope; if it carries \`.md\` / \`.mdx\`, treat those the same as any other knowledge-base file.

Why: native tools skip frontmatter, backlinks, shadow-repo activity, and project git history that OK's tools return for every matched knowledge-base file. \`exec\` is the primary read surface; it runs read-only bash (\`cat\`, \`ls\`, \`grep\`, \`find\`, \`head\`, \`tail\`, \`wc\`, \`sort\`, \`uniq\`, \`cut\`) and returns raw stdout plus enriched metadata per file. One command or a pipe (\`|\`) per call — it is NOT a shell, so \`&&\` / \`;\` / redirects are rejected; list several dirs with \`ls -A a b c\` or make separate calls.

**MCP tool visibility — not seeing \`exec\` is NOT the escape hatch.** MCP wiring varies by client. Claude Code, Cursor, Codex, Windsurf, VS Code — each surfaces MCP differently. Server labels are user-defined; tools may not appear as top-level symbols named \`exec\` in your specific UI. If Open Knowledge is registered as an MCP server in this workspace, route markdown reads through its \`exec\` / \`search\` via your client's documented MCP invocation (including any generic "call MCP tool" flow). Registration is the test, not top-level-symbol visibility.

**Escape hatch.** Native \`Read\` / \`Grep\` / \`Glob\` on \`.md\` / \`.mdx\` is allowed **only** when no Open Knowledge MCP server is registered for this project, **or** immediately after you tried an MCP call and it failed — then begin a user-visible sentence with \`Open Knowledge MCP unavailable:\`. Never use the hatch because you skipped your client's MCP path, didn't see \`exec\` as a top-level tool, or rationalized the skill wasn't necessary.

**Source code and non-markdown files** (\`.ts\`, \`.py\`, \`package.json\`, …): native \`Read\` / \`Grep\` / \`Glob\` always.

## Reads — examples

- Read a file: \`exec("cat <path>.md")\` — contents + full rich enrichment.
- List a directory: \`exec("ls -A <dir>")\` — per-child frontmatter, recursive markdown counts, most-recently-updated doc per subdir, the folder's own \`title\`/\`description\`/\`tags\` + \`templates_available\`. Prefer \`-A\` over plain \`ls\` to surface dot-prefixed entries (\`.ok/\`, \`.okignore\`) without the noisy \`.\`/\`..\` rows that \`-a\` adds.
- Literal search: \`exec("grep -rn <term> <dir> | head -5")\` — matches + enrichment on matched files.
- Ranked search: \`search({ query })\` — cmd-K parity (title boost + body BM25 + recency); use when picking the best doc, not when listing every occurrence.

## Preview — open the browser at session start

The user watches your edits land in a live browser preview. Open it once at session start, then keep working. Re-navigate only when the user asks to open a different doc, or to land them on a finished deliverable (see below) — not to re-check your own edits.

**End a turn on the deliverable, not your scratch space.** Keep the preview steady *during* a multi-doc task — don't yank it around to re-check your own edits. But when a turn created or substantially changed user-facing docs, navigate the preview to the primary deliverable before you hand back: the hub / overview / index page when you created several docs, or the changed doc when you changed one. Don't step the user through every supporting source card — the user is watching, so leave them on the result.

**\`previewUrl\` is a route, not a URL to open.** Every read response (per-doc, on \`exec\` / \`search\` / \`links\` rows) and every write response carries a \`previewUrl\` — a route fragment like \`/#/specs/foo/SPEC\`, with **no scheme, host, or port**. It identifies *which doc* to preview, not a URL to hand a browser by itself. Never construct or guess preview URLs.

**OK ships first-class preview support for three apps — Claude Code Desktop, Cursor, and the Codex desktop app — plus the Claude Code CLI on a separate track (below). Make the preview seamless in each.** Match on the tool you actually have (capability, not host name): if a tool can navigate to a URL, it counts as an in-app browser. The three apps map to:

- **Claude Code Desktop — you have \`preview_*\` tools** (e.g. \`preview_start\` + \`preview_eval\`) → **First open of the session:** to land directly on a doc, arm it first with \`preview_url({ armPaneTarget: true, document })\` (or \`folder\`), then \`preview_start("open-knowledge-ui")\` — \`ok ui\` redirects the base-open straight to the armed route, so the pane opens on the doc, not root. Plain \`preview_start\` (no arm) opens at root. **Moving between docs once the pane is open: do it in one \`preview_eval\` step — set \`window.location.hash\` to the target's route fragment from the response \`previewUrl\`, the part from \`#\` on (e.g. \`window.location.hash = '#/specs/foo/SPEC'\`).** That drives the SPA router directly. Arm + \`preview_start\` only redirects a *fresh* open; it can't move an already-open pane (\`preview_start\` reuses the live process without reloading), so use \`preview_eval\` there. Don't read or edit \`.claude/launch.json\` — host-managed; the OK lock-collision proxy handles the UI-already-running case. If \`preview_start\` fails, report it; don't "fix" \`launch.json\`.
- **Cursor / Codex desktop — no \`preview_*\` tool, but you have an in-app / built-in browser tool** → call \`preview_url\` once for the **exact** target (\`document\` for a doc, \`folder\` for a folder) and navigate your **in-app browser** straight to the returned \`url\`. Open that deep URL directly — never the root then navigate; omit both args only for the root. Drive the tool your host gives you:
  - **Cursor** → its built-in **Browser** tool, the **\`Navigate\`** action (\`browser_navigate\`, via Cursor's own \`cursor-ide-browser\`). Navigate it to the \`url\` yourself — don't print the URL or shell out to the system browser. (A *surfaced* link in Cursor follows its "Browser Tab" vs "Google Chrome" picker and may open the system browser; you calling \`Navigate\` avoids that. A third-party MCP like OK cannot push a URL into the pane — only the agent's own \`Navigate\` can.)
  - **Codex desktop app** → its in-app **Browser** plugin (\`@Browser\`); drive it to the \`url\` (Codex navigates via \`tab.goto\`).
  - **Any other host** with a URL-navigation tool (\`browser\`, \`view_url\`, \`open_url\`, \`web.browse\`, …) → navigate it to the \`url\`. **This is also the fallback when a named tool above isn't present under that exact name** (hosts rename tools): match on the capability, not the name. If no URL-navigation tool exists at all, drop to the Claude Code CLI track below.
- **Honor \`autoOpen\`** (on \`preview_url\`, or on \`warning\` for write tools). If \`false\`, do not open or refresh any preview UI; surface the URL only if asked.

**Claude Code CLI — a separate track (no browser).** The CLI is pure stdio: don't open or fake a browser. For an "open \`<doc>\`/\`<folder>\`" request, run **\`ok open <doc>\`** (\`--folder\` for a folder) — it deep-links the doc into OK Desktop (folders open in the browser); an action you run, not a URL to print. Any other pure-stdio host with **no** URL-navigation tool is on this track too — but if you *do* have a tool that navigates to a URL, use the in-app branch above, not this track. The Codex **CLI**, **IDE extension**, and **Cloud** also live here (web search only, no localhost browser). No \`ok\` on PATH or no shell → \`preview_url\`, then \`open <url>\` in the system browser as a last resort, and say so plainly. The system browser is the fallback, never the default.

**Opening or reading a file IS a preview navigation.** On any "open \`<file>\`" / "read \`<file>\`" request, navigate the browser to that doc's \`previewUrl\` route from the tool response — not a separate fetch, not a fresh system-browser launch.

**Four signals to check if the preview is already attached** (read these from each write response):

1. You opened/navigated earlier this session → don't reopen.
2. Write response has \`previewUrl\` (non-null route) and NO \`warning\` → a browser is attached somewhere; do nothing.
3. \`warning: { action: "attach-preview-once", previewUrl, message }\` → UI reachable, no browser attached; navigate one-shot (\`preview_start\`, or \`preview_url\` → in-app browser).
4. \`warning: { action: "start-ui", previewUrl: null, message }\` → no UI running anywhere. Surface the message verbatim — recovery options are in the in-band copy. Don't loop on retries.

Warnings fire at most once per session in the fresh-start case.

**Re-point at the end of a multi-doc workflow; don't claim a doc is on screen unless you put it there.** The one-shot attach (signal 3) opens the preview *once* — later writes do NOT move the pane; it stays on the doc you last navigated to. When a turn touches several docs, finish by navigating the preview to the doc the user should land on, using your host's move mechanism (\`preview_eval\` setting \`window.location.hash\` from the response \`previewUrl\`, or \`preview_url\` → in-app browser; honor \`autoOpen\`). Until you have navigated there *this* turn, don't tell the user a doc is "open" / "on screen" — at most, say the preview may still be on the doc you opened earlier.

**\`previewUrl: null\` only means "no UI reachable" on the two attach-warning tools: \`write\` / \`edit\`.** Workflow tools return prose and don't carry \`previewUrl\`. \`delete\` / \`move\` emit \`previousPreviewUrl\` (different field, for closing stale tabs) and don't fire attach warnings. \`preview_url\` auto-starts the backend on demand (same \`OK_MCP_AUTOSTART\` gate as writes; a cold first call can take seconds) and reports \`running: false\` + \`url: null\` only when no UI could be reached — its hint names the right command.

If you see \`"Hocuspocus server is not running"\`, run \`ok start\` and retry.

OK Electron and \`ok ui\` share \`ui.lock\`; when a second UI binds a different port, the OK lock-collision proxy bridges it to the live server transparently. That is exactly why \`previewUrl\` is route-only — the port behind the proxy is not the agent's to use. **Do not nudge the user to quit OK Electron to free a port** — the proxy handles it, and quitting tears down a UI in active use.

**The preview is read-only for the agent — it is the user's view, not a surface you read back.** You cannot click or type to drive edits — the CRDT flow is one-way (agent → MCP → CRDT → preview).

**No screenshots to confirm edits, no generic verification loop.** Do NOT take \`preview_screenshot\` (host tool, not OK MCP) after a write, and do not run a generic snapshot/eval/screenshot verification loop — OK's preview is a read-only, one-way mirror, so the CRDT tool response *is* the confirmation that an edit landed. Screenshot only when debugging a visual rendering issue or when the user explicitly asks to see the preview — never to confirm an edit landed. (Navigating the pane with \`preview_eval\` by setting \`window.location.hash\` is fine — that drives the view, it is not a read-back verification loop.)

## Scope recap

Open Knowledge looks for documents under the resolved \`content.dir\` (discoverable at runtime via \`config({ key: 'content.dir' })\`). \`.gitignore\` and \`.okignore\` (at the project root and at any folder depth) define exclusions. A folder's own metadata + templates live in nested \`<folder>/.ok/frontmatter.yml\` + \`<folder>/.ok/templates/\` — NOT in \`.ok/config.yml\`.

Default mental model (no jargon): **every \`.md\` and \`.mdx\` under \`content.dir\`** not excluded by \`.gitignore\` or \`.okignore\` is an Open Knowledge document — including under \`specs/\`, \`reports/\`, \`docs/\`, etc. Read \`.okignore\` (and any nested \`.okignore\` files) once per turn to know what's excluded.

**First session in this project?** If substantial folders have no frontmatter of their own and no \`templates_available\`, the project isn't onboarded — invoke \`workflow({ kind: 'discover' })\` before writing.

**Working in a git worktree?** Pass the worktree's absolute path as \`cwd\` on your OK tool calls once — it sticks for the rest of the session, so reads, writes, and the preview all target that worktree instead of the main checkout. If a tool warns that it routed to the main checkout while you're in a worktree, passing \`cwd\` once is the fix.


Full guidance lives in the bundled \`open-knowledge\` skill at \`~/.ok/skills/open-knowledge/SKILL.md\`.
`;
}
