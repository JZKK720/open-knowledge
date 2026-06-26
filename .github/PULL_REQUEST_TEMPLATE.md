## What & why

<!-- One or two sentences on the change and the motivation. Link any related issue. -->

## How this was verified

<!-- How you tested: `bun run check` output, manual steps, before/after screenshots for UI changes. -->

## Checklist

- [ ] I ran the smallest relevant local check, or explained why I could not.
- [ ] I added tests or a manual verification note for behavior changes.
- [ ] I added a changeset for runtime behavior changes, or this PR does not need one.
- [ ] I updated docs when behavior, commands, or contributor flow changed.
- [ ] I updated `bun.lock` and `THIRD_PARTY_NOTICES.md` if dependencies changed.
- [ ] I did not include secrets, credentials, customer data, local machine paths, or generated debug artifacts.
- [ ] I have read [CONTRIBUTING.md](../CONTRIBUTING.md) and agree to license my contribution under the project's terms, including the CLA when prompted.

---

### How our PR flow works — please read

This repository is **mirrored from an internal monorepo**. After you open this PR:

1. A bot mirrors your changes internally for review (it posts a link you won't be able to open — that's expected).
2. Maintainer review and full CI (lint, typecheck, tests) happen internally; results are **not** posted back to this PR.
3. Once the change lands internally and syncs back, **your PR is closed — not merged.** Your authorship is preserved.

If you don't hear back within a few business days, commenting to nudge is welcome. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full flow.
