---
name: Scoped workspace installs
description: Package installation behavior for this pnpm monorepo.
---

When adding dependencies for an artifact, install them with a package filter so they land in the artifact package rather than the workspace root.

**Why:** The generic language-package installer targets the workspace root in this monorepo and can fail on pnpm's workspace-root safety check or create the wrong dependency ownership.

**How to apply:** Use the artifact's `@workspace/<slug>` filter for package additions, then run that artifact's typecheck and tests.