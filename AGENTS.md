# Repository agent notes

## Changelog

- Always update `CHANGELOG.md` under the `[Unpublished]` section when creating a commit.
- Add each change under the appropriate `Added`, `Changed`, or `Fixed` heading.
- Commits that touch `packages/markdoc-md` must also update `packages/markdoc-md/CHANGELOG.md` as described by that package's `AGENTS.md`.

## Seeded test account

- The development/test seed in `apps/app/scripts/seed.ts` creates the non-production account `test@test.com` with password `password123` (username: `testuser`).
- Use these credentials only against local, test, or explicitly seeded environments. Do not assume the account exists in production.

## Orb preview workflow

- The default `app` service builds with Bun/Turbopack and serves a production review snapshot with Bun, matching the Docker runtime. Start it with `amp orb services ensure`.
- Keep Node installed for build helpers. Do not pass Bun's `--env-file` to the build: Next loads the app's `.env` itself, and forwarding that flag to a Node helper fails. The server still uses Bun's `--env-file`.
- There is no hot reload. After changing app code, run `amp orb service restart app` to rebuild, verify the updated portal, and only then hand it to the user. If the build fails, report that the preview is unavailable or stale.
- Dev mode is optional for rapid agent iteration. Start an internal server with `amp orb service start app-dev --port 3000 --command 'bun --bun next dev apps/app --webpack -p "$PORT"'`; do not add a second default portal.
- Stop it with `amp orb service stop app-dev` before handoff. Keep the production snapshot under `.next/preview` separate from dev output, and do not present a dev server as the final review preview.
