import { authed } from "@/orpc";
import { embeddingsHandler } from "./admin/embeddings";
import { usageHandler as adminUsageHandler } from "./admin/usage";
import { usersHandler as adminUsersHandler } from "./admin/users";
import { documentsHandler } from "./documents";
import { scribeHandler, scribeStreamHandler } from "./scribe";
import { getUsage } from "./scribe/_lib/get-usage";
import { templatesHandler as publicTemplatesHandler } from "./templates";
import { findRelevantTemplateHandler } from "./templates/search";
import { snippetsHandler } from "./user/snippets";
import { templatesHandler as userTemplatesHandler } from "./user/templates";

/**
 * oRPC Router
 *
 * Provides type-safe API endpoints for:
 * - AI document generation (streaming)
 * - Template management and search
 * - User preferences and snippets
 * - Admin tools
 */

const getUsageHandler = authed.handler(({ context }) => {
	return getUsage(context.session);
});

export const router = {
	// AI document generation
	scribe: scribeHandler,
	scribeStream: scribeStreamHandler,
	getUsage: getUsageHandler,

	// Template operations
	templates: {
		...publicTemplatesHandler,
		findRelevant: findRelevantTemplateHandler,
	},

	// Document operations
	documents: {
		...documentsHandler,
	},

	// User-specific operations
	user: {
		templates: {
			...userTemplatesHandler,
		},
		snippets: {
			...snippetsHandler,
		},
	},

	// Admin operations
	admin: {
		users: {
			...adminUsersHandler,
		},
		usage: {
			...adminUsageHandler,
		},
		embeddings: {
			...embeddingsHandler,
		},
	},
};
