# Linking — mechanics

(Core carries the MUST: link noun-phrases with standard markdown links, every link resolves, verify with `links({ kind: "dead" })`. This file carries the full rule set.)

- **Every noun-phrase that names another document should be linked** using standard markdown link syntax: `[text](./relative/path.md)` or `[text](/absolute/from/content-root.md)`.
- **External web sources are NOT inline body links.** Per the Grounding rule, web URLs live in the `source_url:` frontmatter of an ingested doc under `external-sources/` (or the project's equivalent raw-sources folder); the body cites the local path: `[source name](./external-sources/source-slug.md)`. A raw `[source](https://...)` inline in the body is a TODO, not a citation — see Grounding for the closed-loop contract.
- **Internal cross-refs between OK docs** → `[text](./other-doc.md)` — link liberally to aid navigation.
- **Every link must resolve to a doc that exists.** Never link to a doc that isn't written yet. If you want to reference something that should have its own page but doesn't: create that page in the same pass, or record it as a tracked task (`TaskCreate`, or your host's task tool — if the host has none, tell the user) and leave the mention as plain prose. A broken link is debt, not a to-do marker.
- **Never wrap a link in backticks.** `` `[text](./foo.md)` `` is a bug — the backticks make it render as literal code rather than a link.
- **Never use HTML anchors** (`<a href="...">`). Markdown link syntax only.
- **Verify before walking away.** After writing a doc, call `links({ kind: "dead", sourceDocuments: ["your/doc"] })` to find broken references. Fix or remove every one — a dead link is never acceptable to leave behind. Companion `links` kinds: `backlinks` (incoming), `forward` (outgoing), `orphans` (no incoming), `hubs` (high-incoming), `suggest` (untextualized mentions worth linking).
- **The editor's red-underline visual lies.** Its dead-link detection tolerates slug-fallback (e.g., `foo` may appear resolved because `foo.md` exists at root). `links({ kind: "dead" })` is strict-exact — trust the tool, not the visual.

**Note on wiki-link syntax (`[[Page]]`):** the parser still handles it for legacy content, but it's NO LONGER the recommended default. Write new content with standard markdown links per above. Seed-pack templates (`ok seed --pack <name>`) may still emit `[[Page]]` placeholders inside template body text — those are legacy. When you instantiate a seed-pack template, replace the legacy placeholders with standard markdown links during the `{shape}`-fill pass.
