# Repository agent notes

## Changelog

- Always update `CHANGELOG.md` under the `[Unpublished]` section when creating a commit.
- Add each change under the appropriate `Added`, `Changed`, or `Fixed` heading.
- Commits that touch `packages/markdoc-md` must also update `packages/markdoc-md/CHANGELOG.md` as described by that package's `AGENTS.md`.

## Seeded test account

- The development/test seed in `packages/database/seed.ts` creates the non-production account `test@test.com` with password `password123` (username: `testuser`).
- Use these credentials only against local, test, or explicitly seeded environments. Do not assume the account exists in production.
