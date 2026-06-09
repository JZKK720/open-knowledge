---
"@inkeep/open-knowledge-app": patch
---

The `html preview` code block now surfaces a friendly, dismissible notice when its security policy blocks a network request, instead of silently rendering a broken embed. The preview iframe reports blocked requests (for example plain `http://` resources, or code that uses `eval`) back to the editor, which lists what was blocked and why. This is especially helpful inside the desktop preview, where the browser console is out of reach. The preview's Content Security Policy is unchanged.
