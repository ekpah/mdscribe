import { ORPCError } from "@orpc/server";
import { aiScribeFormConfig, and, eq, isNull, or, template } from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { AI_SCRIBE_FORM_SLUG_REGEX, isReservedAiScribeFormSlug } from "@/lib/ai-scribe-forms";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { USER_MESSAGES } from "@/lib/user-messages";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

export const promptHarnessSchema = z
	.string()
	.trim()
	.min(1, "Basis-Prompt ist erforderlich")
	.transform((value, context): PromptHarnessId => {
		const promptHarnessId = resolvePromptHarnessId(value);
		if (!promptHarnessId) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Basis-Prompt ist ungültig",
			});
			return value as PromptHarnessId;
		}

		return promptHarnessId;
	});

const slugSchema = z
	.string()
	.trim()
	.min(1, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.regex(AI_SCRIBE_FORM_SLUG_REGEX, "Aus dem Namen konnte kein gültiger Pfad erzeugt werden")
	.refine((value) => !isReservedAiScribeFormSlug(value), {
		message: "Dieser Name erzeugt einen reservierten Pfad",
	});

export const scribeFormVisibilitySchema = z.enum(["public", "private"]);
export type ScribeFormVisibility = z.infer<typeof scribeFormVisibilitySchema>;

export const createScribeFormInput = z.object({
	description: z.string().trim().nullable().optional(),
	enabled: z.boolean(),
	name: z.string().trim().min(1, "Name ist erforderlich"),
	promptHarness: promptHarnessSchema,
	slug: slugSchema,
	templateId: z.string().nullable().optional(),
	visibility: scribeFormVisibilitySchema.default("public"),
});

export const updateScribeFormInput = createScribeFormInput.extend({
	id: z.string(),
});

export const deleteScribeFormInput = z.object({
	id: z.string(),
});

export const parseWithBadRequest = <T>(schema: z.ZodType<T>, input: unknown): T => {
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

export const toScribeFormValues = (input: {
	authorId?: string | null;
	description?: string | null;
	enabled: boolean;
	name: string;
	promptHarness: string;
	slug: string;
	templateId?: string | null;
	visibility?: ScribeFormVisibility;
}) => {
	const values = {
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
		visibility: input.visibility ?? "public",
	};

	if ("authorId" in input) {
		return {
			...values,
			authorId: input.authorId,
		};
	}

	return values;
};

export const ensureCanSaveScribeFormVisibility = async ({
	db,
	userId,
	visibility,
}: {
	db: Database;
	userId: string;
	visibility: ScribeFormVisibility;
}) => {
	if (visibility === "public") {
		return;
	}

	const entitlements = await resolveProductEntitlements({ db, userId });
	if (!entitlements.canCreatePrivateAiScribeForms) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.privateAiScribeFormRequiresPlus,
		});
	}
};

export const ensureTemplateExists = async (
	context: { db: Database },
	input: { templateId?: string | null },
): Promise<void> => {
	if (!input.templateId) {
		return;
	}

	const existingTemplate = await context.db.query.template.findFirst({
		where: eq(template.id, input.templateId),
	});
	if (!existingTemplate) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Ausgewähltes Template wurde nicht gefunden",
		});
	}
};

export const ensureVisibleTemplateExists = async ({
	context,
	input,
	userId,
}: {
	context: { db: Database };
	input: { templateId?: string | null };
	userId: string;
}): Promise<void> => {
	if (!input.templateId) {
		return;
	}

	const existingTemplate = await context.db.query.template.findFirst({
		where: and(
			eq(template.id, input.templateId),
			or(eq(template.visibility, "public"), eq(template.authorId, userId)),
		),
	});
	if (!existingTemplate) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Ausgewähltes Template wurde nicht gefunden",
		});
	}
};

export const ensureSlugUnique = async (
	context: { db: Database },
	{
		slug,
		authorId,
		excludeId,
	}: { slug: string; authorId: string | null; excludeId?: string },
): Promise<void> => {
	// Slugs are unique per namespace: global (author-less) vs. per author.
	const namespaceWhere =
		authorId === null
			? and(
					eq(aiScribeFormConfig.slug, slug),
					isNull(aiScribeFormConfig.authorId),
				)
			: and(
					eq(aiScribeFormConfig.slug, slug),
					eq(aiScribeFormConfig.authorId, authorId),
				);

	const existing = await context.db.query.aiScribeFormConfig.findFirst({
		where: namespaceWhere,
	});

	if (existing && existing.id !== excludeId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Eine Vorlage mit diesem Namen existiert bereits",
		});
	}
};
