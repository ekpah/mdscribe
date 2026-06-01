import { ORPCError, type } from "@orpc/server";
import { aiScribeFormConfig, eq, inArray, notInArray, template } from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { AI_SCRIBE_FORM_SLUG_REGEX, isReservedAiScribeFormSlug } from "@/lib/ai-scribe-forms";
import {
	BUILT_IN_AISCRIBE_OVERRIDE_KEYS,
	BUILT_IN_AISCRIBE_OVERRIDE_SLUGS,
	getBuiltInAiscribeOverride,
} from "@/lib/aiscribe-built-ins";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { PROMPT_HARNESS_IDS } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

const promptHarnessSchema = z
	.string()
	.trim()
	.min(1, "Basis-Prompt ist erforderlich")
	.refine(
		(value): value is PromptHarnessId => PROMPT_HARNESS_IDS.includes(value as PromptHarnessId),
		{
			message: "Basis-Prompt ist ungültig",
		},
	);

const slugSchema = z
	.string()
	.trim()
	.min(1, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.regex(AI_SCRIBE_FORM_SLUG_REGEX, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.refine((value) => !isReservedAiScribeFormSlug(value), {
		message: "Dieser Name erzeugt einen reservierten Pfad",
	});

const baseFormSchema = z.object({
	description: z.string().trim().nullable().optional(),
	enabled: z.boolean(),
	name: z.string().trim().min(1, "Name ist erforderlich"),
	promptHarness: promptHarnessSchema,
	slug: slugSchema,
	templateId: z.string().nullable().optional(),
});

const createFormInput = baseFormSchema;

const updateFormInput = baseFormSchema.extend({
	id: z.string(),
});

const deleteFormInput = z.object({
	id: z.string(),
});

const builtInFormInput = z.object({
	enabled: z.boolean(),
	key: z.enum(BUILT_IN_AISCRIBE_OVERRIDE_KEYS),
	promptHarness: promptHarnessSchema,
	templateId: z.string().nullable().optional(),
});

const parseWithBadRequest = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe",
		});
	}

	return parsed.data;
};

const toNullableString = (value?: string | null): string | null =>
	value && value.trim().length > 0 ? value : null;

const toNullableText = (value?: string | null): string | null => {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const ensureTemplateExists = async (
	context: { db: Database },
	input: { templateId?: string | null },
): Promise<void> => {
	if (input.templateId) {
		const existingTemplate = await context.db.query.template.findFirst({
			where: eq(template.id, input.templateId),
		});
		if (!existingTemplate) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Ausgewähltes Template wurde nicht gefunden",
			});
		}
	}
};

const toScribeFormValues = (input: {
	description?: string | null;
	enabled: boolean;
	name: string;
	promptHarness: string;
	slug: string;
	templateId?: string | null;
}) => ({
	description: toNullableText(input.description),
	enabled: input.enabled,
	inputPreset: "fullClinicalContext" as const,
	maxTokens: null,
	name: input.name,
	promptHarness: input.promptHarness,
	slug: input.slug,
	temperature: null,
	templateId: toNullableString(input.templateId),
	thinkingBudget: null,
	updatedAt: new Date(),
});

const ensureSlugUnique = async (
	context: { db: Database },
	slug: string,
	excludeId?: string,
): Promise<void> => {
	const existing = await context.db.query.aiScribeFormConfig.findFirst({
		where: eq(aiScribeFormConfig.slug, slug),
	});

	if (existing && existing.id !== excludeId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Eine Vorlage mit diesem Namen existiert bereits",
		});
	}
};

const listFormsHandler = authed.use(requiredAdminMiddleware).handler(({ context }) =>
	context.db.query.aiScribeFormConfig.findMany({
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
		where: notInArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
		with: {
			template: {
				columns: {
					id: true,
					title: true,
				},
			},
		},
	}),
);

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
						promptHarness: override.promptHarness,
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
	.input(type<z.infer<typeof createFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createFormInput, input);
		await ensureTemplateExists(context, parsed);
		await ensureSlugUnique(context, parsed.slug);

		const [created] = await context.db
			.insert(aiScribeFormConfig)
			.values(toScribeFormValues(parsed))
			.returning();

		return created;
	});

const updateFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof updateFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(updateFormInput, input);
		await ensureTemplateExists(context, parsed);
		await ensureSlugUnique(context, parsed.slug, parsed.id);

		const [updated] = await context.db
			.update(aiScribeFormConfig)
			.set(toScribeFormValues(parsed))
			.where(eq(aiScribeFormConfig.id, parsed.id))
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
	.input(type<z.infer<typeof deleteFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(deleteFormInput, input);
		await context.db.delete(aiScribeFormConfig).where(eq(aiScribeFormConfig.id, parsed.id));

		return { success: true };
	});

const upsertBuiltInFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof builtInFormInput>>())
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
			where: eq(aiScribeFormConfig.slug, definition.slug),
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
