import { ORPCError, type } from "@orpc/server";
import { aiScribeFormConfig, and, eq, inArray, isNull, notInArray } from "@repo/database";
import { z } from "zod";

import {
	BUILT_IN_AISCRIBE_OVERRIDE_KEYS,
	BUILT_IN_AISCRIBE_OVERRIDE_SLUGS,
	getBuiltInAiscribeOverride,
} from "@/lib/aiscribe-built-ins";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import {
	createScribeFormInput,
	deleteScribeFormInput,
	ensureSlugUnique,
	ensureTemplateExists,
	parseWithBadRequest,
	promptHarnessSchema,
	toScribeFormValues,
	updateScribeFormInput,
} from "@/orpc/scribe-forms/shared";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";

const normalizePromptHarnessReference = (promptHarness: string): string =>
	resolvePromptHarnessId(promptHarness) ?? promptHarness;

const builtInFormInput = z.object({
	enabled: z.boolean(),
	key: z.enum(BUILT_IN_AISCRIBE_OVERRIDE_KEYS),
	promptHarness: promptHarnessSchema,
	templateId: z.string().nullable().optional(),
});

const listFormsHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const forms = await context.db.query.aiScribeFormConfig.findMany({
		columns: {
			description: true,
			enabled: true,
			id: true,
			name: true,
			promptHarness: true,
			slug: true,
			templateId: true,
		},
		orderBy: (form, { asc }) => [asc(form.createdAt)],
		where: and(
			isNull(aiScribeFormConfig.authorId),
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

const listBuiltInFormsHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	const overrides = await context.db.query.aiScribeFormConfig.findMany({
		columns: {
			description: true,
			enabled: true,
			id: true,
			promptHarness: true,
			slug: true,
			templateId: true,
		},
		where: inArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
		with: {
			template: {
				columns: {
					id: true,
					title: true,
				},
			},
		},
	});

	const overrideBySlug = new Map(overrides.map((override) => [override.slug, override]));

	return BUILT_IN_AISCRIBE_OVERRIDE_KEYS.map((key) => {
		const definition = getBuiltInAiscribeOverride(key);
		const override = overrideBySlug.get(definition.slug);

		return {
			defaultPromptHarness: definition.defaultPromptHarness,
			description: definition.description,
			key,
			override: override
				? {
						description: override.description,
						enabled: override.enabled,
						id: override.id,
						promptHarness: normalizePromptHarnessReference(override.promptHarness),
						template: override.template,
						templateId: override.templateId,
					}
				: null,
			path: definition.path,
			slug: definition.slug,
			title: definition.title,
		};
	});
});

const createFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.input<typeof createScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createScribeFormInput, input);
		await ensureTemplateExists(context, parsed);
		await ensureSlugUnique(context, parsed.slug);

		const [created] = await context.db
			.insert(aiScribeFormConfig)
			.values(toScribeFormValues({ ...parsed, visibility: "public" }))
			.returning();

		return created;
	});

const updateFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.input<typeof updateScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(updateScribeFormInput, input);
		await ensureTemplateExists(context, parsed);
		await ensureSlugUnique(context, parsed.slug, parsed.id);

		const [updated] = await context.db
			.update(aiScribeFormConfig)
			.set(toScribeFormValues({ ...parsed, visibility: "public" }))
			.where(and(eq(aiScribeFormConfig.id, parsed.id), isNull(aiScribeFormConfig.authorId)))
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "AI Form wurde nicht gefunden",
			});
		}

		return updated;
	});

const deleteFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof deleteScribeFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(deleteScribeFormInput, input);
		await context.db
			.delete(aiScribeFormConfig)
			.where(and(eq(aiScribeFormConfig.id, parsed.id), isNull(aiScribeFormConfig.authorId)));

		return { success: true };
	});

const upsertBuiltInFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.input<typeof builtInFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(builtInFormInput, input);
		await ensureTemplateExists(context, parsed);

		const definition = getBuiltInAiscribeOverride(parsed.key);
		const values = toScribeFormValues({
			description: definition.description,
			enabled: parsed.enabled,
			name: definition.title,
			promptHarness: parsed.promptHarness,
			slug: definition.slug,
			templateId: parsed.templateId,
		});

		const existing = await context.db.query.aiScribeFormConfig.findFirst({
			where: and(eq(aiScribeFormConfig.slug, definition.slug), isNull(aiScribeFormConfig.authorId)),
		});

		if (existing) {
			const [updated] = await context.db
				.update(aiScribeFormConfig)
				.set(values)
				.where(eq(aiScribeFormConfig.id, existing.id))
				.returning();

			if (!updated) {
				throw new ORPCError("NOT_FOUND", {
					message: "AI Form wurde nicht gefunden",
				});
			}

			return updated;
		}

		const [created] = await context.db.insert(aiScribeFormConfig).values(values).returning();

		return created;
	});

export const scribeFormsHandler = {
	create: createFormHandler,
	delete: deleteFormHandler,
	list: listFormsHandler,
	listBuiltIn: listBuiltInFormsHandler,
	update: updateFormHandler,
	upsertBuiltIn: upsertBuiltInFormHandler,
};
