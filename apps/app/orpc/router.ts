import { authed } from "@/orpc";
import { embeddingsHandler } from "./admin/embeddings";
import { modelsHandler as adminModelsHandler } from "./admin/models";
import { providersHandler as adminProvidersHandler } from "./admin/providers";
import { scribeHandler as adminScribeHandler } from "./admin/scribe";
import { templatesHandler as adminTemplatesHandler } from "./admin/templates";
import { usageHandler as adminUsageHandler } from "./admin/usage";
import { usersHandler as adminUsersHandler } from "./admin/users";
import { documentsHandler } from "./documents";
import { scribeStreamHandler, voiceFillHandler } from "./scribe";
import { getUsage } from "./scribe/_lib/get-usage";
import { templatesHandler } from "./templates";
import { findRelevantTemplateHandler } from "./templates/search";
import { activityHandler } from "./user/activity";
import { snippetsHandler } from "./user/snippets";

/**
 * oRPC Router
 *
 * Provides type-safe API endpoints for:
 * - AI document generation (streaming)
 * - Template management and search
 * - User preferences and snippets
 * - Admin tools
 */

const getUsageHandler = authed.handler(({ context }) => getUsage(context.session));

export const router = {
	// Admin operations
	admin: {
		embeddings: {
			...embeddingsHandler,
		},
		models: {
			...adminModelsHandler,
		},
		providers: {
			...adminProvidersHandler,
		},
		scribe: {
			...adminScribeHandler,
		},
		templates: {
			...adminTemplatesHandler,
		},
		usage: {
			...adminUsageHandler,
		},
		users: {
			...adminUsersHandler,
		},
	},
	// Document operations
	documents: {
		...documentsHandler,
	},
	getUsage: getUsageHandler,
	// AI document generation
	scribe: {
		voiceFill: voiceFillHandler,
	},
	scribeStream: scribeStreamHandler,
	// Template operations (all CRUD under templates)
	templates: {
		...templatesHandler,
		findRelevant: findRelevantTemplateHandler,
	},
	// User-specific operations
	user: {
		...activityHandler,
		snippets: {
			...snippetsHandler,
		},
	},
};
