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
		aiScribeWorkspaces: lazy(async () => {
			const handlerModule = await import("./admin/ai-scribe-workspaces");
			return { default: handlerModule.aiScribeWorkspacesHandler };
		}),
		emails: lazy(async () => {
			const handlerModule = await import("./admin/emails");
			return { default: handlerModule.emailsHandler };
		}),
		license: lazy(async () => {
			const handlerModule = await import("./admin/license");
			return { default: handlerModule.licenseHandler };
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
		scribeForms: lazy(async () => {
			const handlerModule = await import("./admin/scribe-forms");
			return { default: handlerModule.scribeFormsHandler };
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
		fillInputs: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/fill-inputs");
			return { default: handlerModule.fillInputsHandler };
		}),
		ocrToMarkdown: lazy(async () => {
			const handlerModule = await import("./scribe/handlers/ocr-to-markdown");
			return { default: handlerModule.ocrToMarkdownHandler };
		}),
	},
	// AI documentation agent (text-only MVP)
	scribeAgent: {
		chat: lazy(async () => {
			const handlerModule = await import("./scribe-agent");
			return { default: handlerModule.scribeAgentChatHandler };
		}),
	},
	scribeForms: lazy(async () => {
		const handlerModule = await import("./scribe-forms");
		return { default: handlerModule.scribeFormsHandler };
	}),
	scribeStream: lazy(async () => {
		const handlerModule = await import("./scribe/handlers/scribe-stream");
		return { default: handlerModule.scribeStreamHandler };
	}),
	// Runtime Brief-Baukasten (workspace) resolution for the editor
	scribeWorkspaces: lazy(async () => {
		const handlerModule = await import("./scribe-workspaces");
		return { default: handlerModule.scribeWorkspacesHandler };
	}),

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
		auth: lazy(async () => {
			const handlerModule = await import("./user/auth");
			return { default: handlerModule.authHandler.auth };
		}),
		collections: lazy(async () => {
			const handlerModule = await import("./user/collections");
			return { default: handlerModule.collectionsHandler };
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
