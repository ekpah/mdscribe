import { authed } from "@/orpc";
import { embeddingsHandler } from "./admin/embeddings";
import { modelsHandler as adminModelsHandler } from "./admin/models";
import { providersHandler as adminProvidersHandler } from "./admin/providers";
import { scribeHandler as adminScribeHandler } from "./admin/scribe";
import { scribeFormsHandler as adminScribeFormsHandler } from "./admin/scribe-forms";
import { templatesHandler as adminTemplatesHandler } from "./admin/templates";
import { usageHandler as adminUsageHandler } from "./admin/usage";
import { usersHandler as adminUsersHandler } from "./admin/users";
import { documentsHandler } from "./documents";
import { scribeStreamHandler, voiceFillHandler } from "./scribe";
import { scribeFormsHandler } from "./scribe-forms";
import { getUsage } from "./scribe/_lib/get-usage";
import { templatesHandler } from "./templates";
import { findRelevantTemplateHandler } from "./templates/search";
import { activityHandler } from "./user/activity";
import { collectionsHandler } from "./user/collections";
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

const getUsageHandler = authed.handler(({ context }) => {
	return getUsage(context.session);
});

export const router = {
	// AI document generation
	scribe: {
		voiceFill: voiceFillHandler,
	},
	scribeForms: {
		...scribeFormsHandler,
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
		collections: {
			...collectionsHandler,
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
		scribe: {
			...adminScribeHandler,
		},
		scribeForms: {
			...adminScribeFormsHandler,
		},
		usage: {
			...adminUsageHandler,
		},
		embeddings: {
			...embeddingsHandler,
		},
		templates: {
			...adminTemplatesHandler,
		},
		models: {
			...adminModelsHandler,
		},
		providers: {
			...adminProvidersHandler,
		},
	},
};
