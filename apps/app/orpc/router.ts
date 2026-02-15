import { authed } from "@/orpc";
import { embeddingsHandler } from "./admin/embeddings";
import { modelsHandler as adminModelsHandler } from "./admin/models";
import { scribeHandler as adminScribeHandler } from "./admin/scribe";
import { usageHandler as adminUsageHandler } from "./admin/usage";
import { usersHandler as adminUsersHandler } from "./admin/users";
import { documentsHandler } from "./documents";
import {
	scribeHandler as scribeTemplateHandler,
	scribeStreamHandler,
	voiceFillHandler,
} from "./scribe";
import { getUsage } from "./scribe/_lib/get-usage";
import { templatesHandler } from "./templates";
import { findRelevantTemplateHandler } from "./templates/search";
import { activityHandler } from "./user/activity";
import { snippetsHandler } from "./user/snippets";
import { adminSettingsHandler, settingsHandler } from "./settings";

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
	scribe: {
		template: scribeTemplateHandler,
		voiceFill: voiceFillHandler,
	},
	scribeStream: scribeStreamHandler,
	getUsage: getUsageHandler,

	// Template operations (all CRUD under templates)
	templates: {
		...templatesHandler,
		findRelevant: findRelevantTemplateHandler,
	},

	// Document operations
	documents: {
		...documentsHandler,
	},

	// User-specific operations
	user: {
		...activityHandler,
		snippets: {
			...snippetsHandler,
		},
	},

	// Public settings
	settings: {
		...settingsHandler,
	},

	// Admin operations
	admin: {
		users: {
			...adminUsersHandler,
		},
		scribe: {
			...adminScribeHandler,
		},
		usage: {
			...adminUsageHandler,
		},
		embeddings: {
			...embeddingsHandler,
		},
		models: {
			...adminModelsHandler,
		},
		settings: {
			...adminSettingsHandler,
		},
	},
};
