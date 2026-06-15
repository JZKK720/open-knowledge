---
"@inkeep/open-knowledge": patch
---

Fix literal `&#x20;` characters appearing in the editor after closing and reopening a document. A space at the edge of a paragraph, bold/italic run, inline code, or list item is stored by the byte-fidelity engine as the numeric character reference `&#x20;` (or `&#x9;` for a tab); on a cold reopen that reference was restored as the visible literal text `&#x20;` instead of a real space. Whitespace numeric character references now display as the decoded space/tab in the editor while still serializing to the exact same bytes on disk, so source byte-fidelity is unchanged. User-authored entity references (`&amp;`, `&#x41;`) and escaped `\&#x20;` are untouched, and the sourceLiteral security gate continues to reject any non-whitespace divergence between displayed text and persisted bytes.
