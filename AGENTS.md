# Repository agent notes

## Seeded test account

- The development/test seed in `packages/database/seed.ts` creates the non-production account `test@test.com` with password `password123` (username: `testuser`).
- Use these credentials only against local, test, or explicitly seeded environments. Do not assume the account exists in production.
