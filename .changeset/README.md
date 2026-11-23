# Changesets

This folder holds [changesets](https://github.com/changesets/changesets):
small markdown files describing changes that should appear in package release
notes.

When you make a change to a published package, run:

```bash
pnpm changeset
```

Pick the affected packages and a semver bump, and write a short, user-facing
description. Maintainers consume these on release to update versions and each
package's `CHANGELOG.md`.
