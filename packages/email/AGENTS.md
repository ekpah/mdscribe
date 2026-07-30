# Email Package Guidance

Scope: everything under `packages/email`. Root guidance still applies.

- Keep mail delivery provider-neutral. Application callers use `sendEmail` and
  `sendEmailBatch`; provider SDK types and responses must not escape this
  package.
- SMTP configuration comes only from `@repo/env`. Use the primary transport for
  authentication and transactional mail, and the optional broadcast transport
  for marketing mail.
- Never silently fall back to an external provider or log SMTP URLs,
  credentials, message bodies, recipient addresses, or provider responses.
- Send bulk mail as one SMTP envelope per recipient. Use bounded concurrency,
  report partial failures, and never expose recipients through shared `to`,
  `cc`, or `bcc` fields.
- Reuse cached pooled Nodemailer transports. Keep certificate validation
  enabled and require operators to install a trusted internal CA instead of
  disabling TLS verification in production.
- Keep SMTP pool sizing and retry behavior as internal implementation details.
  Do not expose tuning environment variables without a concrete operational
  requirement.
