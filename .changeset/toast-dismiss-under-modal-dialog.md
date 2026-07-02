---
"@inkeep/open-knowledge": patch
---

Fix toasts becoming un-dismissable and covering controls while a modal dialog or
sheet is open. Sonner renders its toaster in a portal on `<body>`, and a modal
Radix layer sets `body { pointer-events: none }`, which the toast inherited, so
it painted on top of the dialog but its close/action buttons were click-dead
(the "Added ok to your PATH" onboarding toast was the visible case). Toasts are
now kept interactive under a modal layer, and dismissing a toast no longer closes
the dialog or sheet beneath it.
