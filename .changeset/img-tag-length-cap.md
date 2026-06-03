---
"@inkeep/open-knowledge-core": patch
---

fix(open-knowledge): render self-closing `<img>` / `<video>` / `<audio>` tags of any length (PRD-6910)

The markdown autolink/HTML guard recognized self-closing canonical media tags
(`<img />`, `<video />`, `<audio />`) only when the entire tag fit inside a fixed
256-character lookahead window. A valid tag with a data-URI `src` or a long
descriptive `alt` exceeded that window and silently fell through to literal text
instead of rendering as a media node — the symptom reported in PRD-6910.

The guard now recognizes the self-closing `/>` form via a precomputed `>`-offset
index (bounded by the tag's own first `>` and the next blank line) rather than a
fixed window, so canonical media tags render regardless of total length. Bare
HTML-void forms (`<img src="x">`, no slash) still parse as text, unchanged. The
check is O(log n) per tag, reintroducing none of the O(n²)/ReDoS risk the
original window guarded against.
