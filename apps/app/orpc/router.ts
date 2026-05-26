import { lazy } from "@orpc/server";

/**
 * oRPC Router
 *
 * Keep this root router lightweight. The root layout installs a direct
 * server-side oRPC client for SSR, so eager imports here are paid by every
 * route compile. Lazy namespaces defer backend handler graphs until the
 * specific procedure path is called.
 */
export const router = {
	// Admin operations
	admin: {
		embeddings: lazy(async () => ({
			default: (await import("./admin/embeddings")).embeddingsHandler,
		})),
		models: lazy(async () => ({
			default: (await import("./admin/models")).modelsHandler,
		})),
		providers: lazy(async () => ({
			default: (await import("./admin/providers")).providersHandler,
		})),
		scribe: lazy(async () => ({
			default: (await import("./admin/scribe")).scribeHandler,
		})),
		scribeForms: lazy(async () => ({
			default: (await import("./admin/scribe-forms")).scribeFormsHandler,
		})),
		templates: lazy(async () => ({
			default: (await import("./admin/templates")).templatesHandler,
		})),
		usage: lazy(async () => ({
			default: (await import("./admin/usage")).usageHandler,
		})),
		users: lazy(async () => ({
			default: (await import("./admin/users")).usersHandler,
		})),
	},

	// Document operations
	documents: lazy(async () => ({
		default: (await import("./documents")).documentsHandler,
	})),

	getUsage: lazy(async () => {
		const [{ authed }, { getUsage }] = await Promise.all([
			import("@/orpc"),
			import("./scribe/_lib/get-usage"),
		]);

		return {
			default: authed.handler(({ context }) => getUsage(context.session)),
		};
	}),

	// AI document generation
	scribe: {
		fillInputs: lazy(async () => ({
			default: (await import("./scribe/handlers/fill-inputs")).fillInputsHandler,
		})),
	},
	scribeForms: lazy(async () => ({
		default: (await import("./scribe-forms")).scribeFormsHandler,
	})),
	scribeStream: lazy(async () => ({
		default: (await import("./scribe/handlers/scribe-stream")).scribeStreamHandler,
	})),

	// Template operations (all CRUD under templates)
	templates: lazy(async () => {
		const [{ templatesHandler }, { findRelevantTemplateHandler }] =
			await Promise.all([import("./templates"), import("./templates/search")]);

		return {
			default: {
				...templatesHandler,
				findRelevant: findRelevantTemplateHandler,
			},
		};
	}),

	// User-specific operations
	user: {
		auth: lazy(async () => ({
			default: (await import("./user/auth")).authHandler.auth,
		})),
		collections: lazy(async () => ({
			default: (await import("./user/collections")).collectionsHandler,
		})),
		recentActivity: lazy(async () => ({
			default: (await import("./user/activity")).activityHandler.recentActivity,
		})),
		snippets: lazy(async () => ({
			default: (await import("./user/snippets")).snippetsHandler,
		})),
	},
};
