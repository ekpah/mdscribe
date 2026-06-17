import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	and,
	asc,
	eq,
	favourites,
	inArray,
	isNull,
	notInArray,
	or,
	template,
	user,
} from "@repo/database";
import type { z } from "zod";

import { BUILT_IN_AISCRIBE_OVERRIDE_SLUGS } from "@/lib/aiscribe-built-ins";
import type { Session } from "@/lib/auth-types";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { authed, pub } from "@/orpc";
import { getOptionalAuthSession } from "@/orpc/middlewares/auth";
import {
	createScribeFormInput,
	deleteScribeFormInput,
	ensureCanSaveScribeFormVisibility,
	ensureSlugUnique,
	ensureVisibleTemplateExists,
	parseWithBadRequest,
	toScribeFormValues,
	updateScribeFormInput,
} from "@/orpc/scribe-forms/shared";
import type { ScribeFormVisibility } from "@/orpc/scribe-forms/shared";
import {
	resolvePromptHarnessId,
	SELECTABLE_PROMPT_HARNESS_OPTIONS,
} from "@/orpc/scribe/prompts";

interface PublicScribeForm {
	author?: {
		id: string;
		name: string | null;
		username: string;
	} | null;
	authorId: string | null;
	description: string | null;
	id: string;
	name: string;
	promptHarness: string;
	slug: string;
	template?: {
		id: string;
		title: string;
	} | null;
	visibility: ScribeFormVisibility;
}

const visibleFormWhere = (userId?: string | null) =>
	userId
		? or(eq(aiScribeFormConfig.visibility, "public"), eq(aiScribeFormConfig.authorId, userId))
		: eq(aiScribeFormConfig.visibility, "public");

const visibleTemplateWhere = (userId: string) =>
	or(eq(template.visibility, "public"), eq(template.authorId, userId));

const normalizePromptHarnessReference = (promptHarness: string): string =>
	resolvePromptHarnessId(promptHarness) ?? promptHarness;

const getOptionalUserId = async (context: unknown) => {
	const session = await getOptionalAuthSession((context as { session?: Session }).session);
	return session?.user.id ?? null;
};

const listAvailableHandler = pub.output(type<PublicScribeForm[]>()).handler(async ({ context }) => {
	const userId = await getOptionalUserId(context);
	const forms = await context.db.query.aiScribeFormConfig.findMany({
		columns: {
			authorId: true,
			description: true,
			enabled: true,
			id: true,
			name: true,
			promptHarness: true,
			slug: true,
			visibility: true,
		},
		orderBy: (form, { asc: orderAsc }) => [orderAsc(form.authorId), orderAsc(form.createdAt)],
		where: and(
			eq(aiScribeFormConfig.enabled, true),
			notInArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
			visibleFormWhere(userId),
		),
		with: {
			author: {
				columns: {
					id: true,
					name: true,
					username: true,
				},
			},
			template: {
				columns: {
					id: true,
					title: true,
				},
			},
		},
	});

	return forms.map((form) => ({
		author: form.author,
		authorId: form.authorId,
		description: form.description,
		id: form.id,
		name: form.name,
		promptHarness: normalizePromptHarnessReference(form.promptHarness),
		slug: form.slug,
		template: form.template,
		visibility: form.visibility as ScribeFormVisibility,
	}));
});

const getBySlugHandler = pub
	.input(type<{ slug: string }>())
	.output(type<PublicScribeForm | null>())
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		const form = await context.db.query.aiScribeFormConfig.findFirst({
			columns: {
				authorId: true,
				description: true,
				enabled: true,
				id: true,
				name: true,
				promptHarness: true,
				slug: true,
				visibility: true,
			},
			where: and(
				eq(aiScribeFormConfig.slug, input.slug),
				isNull(aiScribeFormConfig.authorId),
				eq(aiScribeFormConfig.enabled, true),
				visibleFormWhere(userId),
			),
			with: {
				author: {
					columns: {
						id: true,
						name: true,
						username: true,
					},
				},
				template: {
					columns: {
						id: true,
						title: true,
					},
				},
			},
		});

		if (!form) {
			return null;
		}

		return {
			author: form.author,
			authorId: form.authorId,
			description: form.description,
			id: form.id,
			name: form.name,
			promptHarness: normalizePromptHarnessReference(form.promptHarness),
			slug: form.slug,
			template: form.template,
			visibility: form.visibility as ScribeFormVisibility,
		};
	});

const getByUsernameSlugHandler = pub
	.input(type<{ slug: string; username: string }>())
	.output(type<PublicScribeForm | null>())
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		const author = await context.db.query.user.findFirst({
			columns: { id: true },
			where: eq(user.username, input.username),
		});
		if (!author) {
			return null;
		}

		const form = await context.db.query.aiScribeFormConfig.findFirst({
			columns: {
				authorId: true,
				description: true,
				enabled: true,
				id: true,
				name: true,
				promptHarness: true,
				slug: true,
				visibility: true,
			},
			where: and(
				eq(aiScribeFormConfig.authorId, author.id),
				eq(aiScribeFormConfig.slug, input.slug),
				eq(aiScribeFormConfig.enabled, true),
				visibleFormWhere(userId),
			),
			with: {
				author: {
					columns: {
						id: true,
						name: true,
						username: true,
					},
				},
				template: {
					columns: {
						id: true,
						title: true,
					},
				},
			},
		});

		if (!form) {
			return null;
		}

		return {
			author: form.author,
			authorId: form.authorId,
			description: form.description,
			id: form.id,
			name: form.name,
			promptHarness: normalizePromptHarnessReference(form.promptHarness),
			slug: form.slug,
			template: form.template,
			visibility: form.visibility as ScribeFormVisibility,
		};
	});

const listFormsHandler = authed.handler(async ({ context }) => {
	const forms = await context.db.query.aiScribeFormConfig.findMany({
		columns: {
			authorId: true,
			description: true,
			enabled: true,
			id: true,
			name: true,
			promptHarness: true,
			slug: true,
			templateId: true,
			visibility: true,
		},
		orderBy: (form, { asc: orderAsc }) => [orderAsc(form.createdAt)],
		where: and(
			eq(aiScribeFormConfig.authorId, context.session.user.id),
			notInArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
		),
		with: {
			template: {
				columns: {
					id: true,
					title: true,
				},
			},
		},
	});

	return forms.map((form) => ({
		...form,
		promptHarness: normalizePromptHarnessReference(form.promptHarness),
	}));
});

const editorContextHandler = authed.handler(async ({ context }) => {
	const [templates, entitlements] = await Promise.all([
		context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				authorId: template.authorId,
				category: template.category,
				id: template.id,
				title: template.title,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.where(visibleTemplateWhere(context.session.user.id))
			.orderBy(asc(template.category), asc(template.title)),
		resolveProductEntitlements({
			db: context.db,
			userId: context.session.user.id,
		}),
	]);

	const templateIds = templates.map((item) => item.id);
	const favouriteRows =
		templateIds.length > 0
			? await context.db
					.select({
						templateId: favourites.templateId,
					})
					.from(favourites)
					.where(
						and(
							eq(favourites.userId, context.session.user.id),
							inArray(favourites.templateId, templateIds),
						),
					)
			: [];
	const favouriteTemplateIds = new Set(favouriteRows.map((item) => item.templateId));

	return {
		canCreatePrivateAiScribeForms: entitlements.canCreatePrivateAiScribeForms,
		promptHarnesses: SELECTABLE_PROMPT_HARNESS_OPTIONS,
		promptNames: SELECTABLE_PROMPT_HARNESS_OPTIONS.map((option) => option.id),
		templates: templates.map((item) => ({
			...item,
			isAuthored: item.authorId === context.session.user.id,
			isFavourite: favouriteTemplateIds.has(item.id),
		})),
	};
});

const createFormHandler = authed
	.input(type<z.input<typeof createScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createScribeFormInput, input);
		await ensureCanSaveScribeFormVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: parsed.visibility,
		});
		await ensureVisibleTemplateExists({
			context,
			input: parsed,
			userId: context.session.user.id,
		});
		await ensureSlugUnique(context, {
			authorId: context.session.user.id,
			slug: parsed.slug,
		});

		const [created] = await context.db
			.insert(aiScribeFormConfig)
			.values(
				toScribeFormValues({
					...parsed,
					authorId: context.session.user.id,
				}),
			)
			.returning();

		return created;
	});

const updateFormHandler = authed
	.input(type<z.input<typeof updateScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(updateScribeFormInput, input);
		await ensureCanSaveScribeFormVisibility({
			db: context.db,
			userId: context.session.user.id,
			visibility: parsed.visibility,
		});
		await ensureVisibleTemplateExists({
			context,
			input: parsed,
			userId: context.session.user.id,
		});
		await ensureSlugUnique(context, {
			authorId: context.session.user.id,
			excludeId: parsed.id,
			slug: parsed.slug,
		});

		const [updated] = await context.db
			.update(aiScribeFormConfig)
			.set(toScribeFormValues(parsed))
			.where(
				and(
					eq(aiScribeFormConfig.id, parsed.id),
					eq(aiScribeFormConfig.authorId, context.session.user.id),
				),
			)
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "AI Vorlage wurde nicht gefunden",
			});
		}

		return updated;
	});

const deleteFormHandler = authed
	.input(type<z.input<typeof deleteScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(deleteScribeFormInput, input);
		const [deleted] = await context.db
			.delete(aiScribeFormConfig)
			.where(
				and(
					eq(aiScribeFormConfig.id, parsed.id),
					eq(aiScribeFormConfig.authorId, context.session.user.id),
				),
			)
			.returning({ id: aiScribeFormConfig.id });

		if (!deleted) {
			throw new ORPCError("NOT_FOUND", {
				message: "AI Vorlage wurde nicht gefunden",
			});
		}

		return { success: true };
	});

export const scribeFormsHandler = {
	create: createFormHandler,
	delete: deleteFormHandler,
	editorContext: editorContextHandler,
	getBySlug: getBySlugHandler,
	getByUsernameSlug: getByUsernameSlugHandler,
	list: listFormsHandler,
	listAvailable: listAvailableHandler,
	update: updateFormHandler,
};
