// Re-export test utilities from the database package
export { startTestServer, createTestUser, type TestServer } from "@repo/database/test";

/**
 * Admin email addresses (from middlewares/admin.ts)
 */
export const ADMIN_EMAILS = ["nils.hapke@we-mail.de", "n.hapke@bbtgruppe.de"];
