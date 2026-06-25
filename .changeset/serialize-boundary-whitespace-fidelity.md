---
"@inkeep/open-knowledge-core": patch
---

Fix markdown serializer boundary-whitespace defects on the WYSIWYG-to-source path. An insignificant trailing space or tab at a block edge now serializes to a literal character instead of a visible `&#x20;` / `&#x9;` character reference, so source mode no longer shows the escape where a space was typed (a leading tab, or a leading run of four or more spaces, still encodes, since it would otherwise trigger an indented code block on re-parse and turn the paragraph into a code block). Strikethrough (`~~`) and highlight (`==`) marks authored with boundary whitespace now char-ref-encode that whitespace so the mark survives re-parse instead of silently dropping. Emphasis and strong already behaved correctly and are unchanged.
