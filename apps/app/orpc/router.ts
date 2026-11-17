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
		emails: lazy(async () => {
			const handlerModule = await import("./admin/emails");
			return { default: handlerModule.emailsHandler };
		}),
		models: lazy(async () => {
			const handlerModule = await import("./admin/models");
			return { default: handlerModule.modelsHandler };
		}),
		providers: lazy(async () => {
			const handlerModule = await import("./admin/providers");
			return { default: handlerModule.providersHandler };
		}),
		scribe: lazy(async () => {
			const handlerModule = await import("./admin/scribe");
			return { default: handlerModule.scribeHandler };
		}),
		templates: lazy(async () => {
			const handlerModule = await import("./admin/templates");
			return { default: handlerModule.templatesHandler };
		}),
		usage: lazy(async () => {
			const handlerModule = await import("./admin/usage");
			return { default: handlerModule.usageHandler };
		}),
		users: lazy(async () => {
			const handlerModule = await import("./admin/users");
			return { default: handlerModule.usersHandler };
		}),
	},

	// Old AI Scribe URLs → converted templates
	aiscribeRedirect: lazy(async () => {
		const handlerModule = await import("./aiscribe-redirects");
		return { default: handlerModule.resolveAiscribeRedirectHandler };
	}),

	// Context transfer operations
	contextTransfers: lazy(async () => {
		const handlerModule = await import("./context-transfers");
		return { default: handlerModule.contextTransfersHandler };
	}),

	// Document operations
	documents: lazy(async () => {
		const handlerModule = await import("./documents");
		return { default: handlerModule.documentsHandler };
	}),

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
		documentInputPolicy: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/extract-context-file");
			return { default: handlerModule.documentInputPolicyHandler };
		}),
		extractContextFile: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/extract-context-file");
			return { default: handlerModule.extractContextFileHandler };
		}),
		fillInputs: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/fill-inputs");
			return { default: handlerModule.fillInputsHandler };
		}),
		fillInputsStream: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/fill-inputs");
			return { default: handlerModule.fillInputsStreamHandler };
		}),
		resolveDocumentCitations: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/resolve-document-citation");
			return { default: handlerModule.resolveDocumentCitationsHandler };
		}),
	},
	// AI documentation agent, gated by `doctorsNoteAgentFlag`.
	scribeAgent: {
		chat: lazy(async () => {
			const handlerModule = await import("./scribe-agent");
			return { default: handlerModule.scribeAgentChatHandler };
		}),
	},
	scribeStream: lazy(async () => {
		const handlerModule = await import("./scribe/handlers/scribe-stream");
		return { default: handlerModule.scribeStreamHandler };
	}),
	// Preview of AI-assisted Markdoc template editing, gated by `templateAgentFlag`.
	templateAgent: {
		edit: lazy(async () => {
			const handlerModule = await import("./template-agent/edit");
			return { default: handlerModule.templateAgentEditHandler };
		}),
	},

	// Template operations (all CRUD under templates)
	templates: lazy(async () => {
		const handlerModule = await import("./templates");
		return { default: handlerModule.templatesHandler };
	}),

	// User-specific operations
	user: {
		aiFunctionRecommendations: lazy(async () => {
			const handlerModule = await import("./user/activity");
			return {
				default: handlerModule.activityHandler.aiFunctionRecommendations,
			};
		}),
		aiProviders: lazy(async () => {
			const handlerModule = await import("./user/ai-providers");
			return { default: handlerModule.aiProvidersHandler };
		}),
		auth: lazy(async () => {
			const handlerModule = await import("./user/auth");
			return { default: handlerModule.authHandler.auth };
		}),
		collections: lazy(async () => {
			const handlerModule = await import("./user/collections");
			return { default: handlerModule.collectionsHandler };
		}),
		personalContext: lazy(async () => {
			const handlerModule = await import("./user/personal-context");
			return { default: handlerModule.personalContextHandler };
		}),
		recentActivity: lazy(async () => {
			const handlerModule = await import("./user/activity");
			return { default: handlerModule.activityHandler.recentActivity };
		}),
		snippets: lazy(async () => {
			const handlerModule = await import("./user/snippets");
			return { default: handlerModule.snippetsHandler };
		}),
	},
};
