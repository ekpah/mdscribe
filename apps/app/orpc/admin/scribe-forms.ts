import { ORPCError, type } from "@orpc/server";
import { aiModel, aiScribeFormConfig, eq, template, type Database } from "@repo/database";
import { z } from "zod";

import { AI_SCRIBE_FORM_SLUG_REGEX, isReservedAiScribeFormSlug } from "@/lib/ai-scribe-forms";
import { authed } from "@/orpc";

import { requiredAdminMiddleware } from "../middlewares/admin";
import { type PromptHarnessId, PROMPT_HARNESS_IDS } from "../scribe/prompts";

const promptHarnessSchema = z
	.string({
		required_error: "Basis-Prompt ist erforderlich",
	})
	.refine(
		(value): value is PromptHarnessId => PROMPT_HARNESS_IDS.includes(value as PromptHarnessId),
		{
			message: "Basis-Prompt ist ungültig",
		},
	);

const slugSchema = z
	.string({
		required_error: "Pfad ist erforderlich",
	})
	.trim()
	.min(1, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.regex(AI_SCRIBE_FORM_SLUG_REGEX, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.refine((value) => !isReservedAiScribeFormSlug(value), {
		message: "Dieser Name erzeugt einen reservierten Pfad",
	});

const baseFormSchema = z.object({
	description: z.string().trim().nullable().optional(),
	enabled: z.boolean(),
	modelId: z.string().nullable().optional(),
	name: z
		.string({
			required_error: "Name ist erforderlich",
		})
		.trim()
		.min(1, "Name ist erforderlich"),
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

async function ensureModelAndTemplateExist(
	context: { db: Database },
	input: { modelId?: string | null; templateId?: string | null },
): Promise<void> {
	if (input.modelId) {
		const existingModel = await context.db.query.aiModel.findFirst({
			where: eq(aiModel.id, input.modelId),
		});
		if (!existingModel) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Ausgewähltes KI-Modell wurde nicht gefunden",
			});
		}
	}

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
}

const toScribeFormValues = (input: {
	description?: string | null;
	enabled: boolean;
	modelId?: string | null;
	name: string;
	promptHarness: string;
	slug: string;
	templateId?: string | null;
}) => ({
	description: toNullableText(input.description),
	enabled: input.enabled,
	inputPreset: "fullClinicalContext" as const,
	maxTokens: null,
	modelId: toNullableString(input.modelId),
	name: input.name,
	promptHarness: input.promptHarness,
	slug: input.slug,
	temperature: null,
	templateId: toNullableString(input.templateId),
	thinkingBudget: null,
	updatedAt: new Date(),
});

async function ensureSlugUnique(
	context: { db: Database },
	slug: string,
	excludeId?: string,
): Promise<void> {
	const existing = await context.db.query.aiScribeFormConfig.findFirst({
		where: eq(aiScribeFormConfig.slug, slug),
	});

	if (existing && existing.id !== excludeId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Eine Vorlage mit diesem Namen existiert bereits",
		});
	}
}

const listFormsHandler = authed.use(requiredAdminMiddleware).handler(async ({ context }) => {
	return context.db.query.aiScribeFormConfig.findMany({
		columns: {
			description: true,
			enabled: true,
			id: true,
			modelId: true,
			name: true,
			promptHarness: true,
			slug: true,
			templateId: true,
		},
		orderBy: (form, { asc }) => [asc(form.createdAt)],
		with: {
			model: {
				columns: {
					displayName: true,
					id: true,
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
});

const createFormHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof createFormInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createFormInput, input);
		await ensureModelAndTemplateExist(context, parsed);
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
		await ensureModelAndTemplateExist(context, parsed);
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

export const scribeFormsHandler = {
	create: createFormHandler,
	delete: deleteFormHandler,
	list: listFormsHandler,
	update: updateFormHandler,
};
