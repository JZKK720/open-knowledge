---
"@inkeep/open-knowledge": minor
---

Invite OK Desktop users to subscribe to product updates from the post-update release-notes card. When the app updates, the "Updated to Version X · Release notes" card in the sidebar footer now also carries a compact "Stay in the loop" subscribe form (reusing the existing form) with a "Follow us on" row for X, GitHub, and Discord — shown only when the user hasn't already subscribed or dismissed it, and for at most three distinct update versions. It never appears on its own (no update, no prompt) and won't re-nag on reopen. Dismissing closes the whole card and stops the prompt for good; subscribing from here or the Resources menu retires it. All state is device-local; web and CLI are unaffected.
