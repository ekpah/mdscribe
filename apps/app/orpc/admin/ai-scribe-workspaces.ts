import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	eq,
	inArray,
	isNull,
	ne,
} from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { parseWithBadRequest, scribeFormVisibilitySchema } from "@/orpc/scribe-forms/shared";
import type { ScribeFormVisibility } from "@/orpc/scribe-forms/shared";
import { getPromptHarnessTargetField } from "@/orpc/scribe/prompts";
import type { CanonicalContextField } from "@/orpc/scribe/prompts";

// One field per prompt-harness section. Each slot is optional — an empty slot
// falls back to the standard (default) template. Befunde is always default.
const formIdSchema = z.string().trim().nullable().optional();

const createWorkspaceInput = z.object({
	anamneseFormId: formIdSchema,
	description: z.string().trim().nullable().optional(),
	diagnosisFormId: formIdSchema,
	enabled: z.boolean().default(true),
	epikriseFormId: formIdSchema,
	name: z.string().trim().min(1, "Name ist erforderlich"),
	visibility: scribeFormVisibilitySchema.default("public"),
});

const updateWorkspaceInput = createWorkspaceInput.extend({
	id: z.string(),
});

const deleteWorkspaceInput = z.object({ id: z.string() });

// Each slot may only reference a form whose prompt harness produces that
// section's canonical field. Befunde is intentionally excluded for now.
const SLOTS = [
	{ field: "diagnoseblock", key: "diagnosisFormId", label: "Diagnosen" },
	{ field: "anamnese", key: "anamneseFormId", label: "Anamnese" },
	{ field: "epikrise", key: "epikriseFormId", label: "Epikrise" },
] as const satisfies readonly {
	field: CanonicalContextField;
	key: "anamneseFormId" | "diagnosisFormId" | "epikriseFormId";
	label: string;
}[];

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.normalize("NFKD")
		.replaceAll(COMBINING_MARKS, "")
		.replaceAll(NON_SLUG_CHARS, "-")
		.replaceAll(EDGE_DASHES, "");

/**
 * Derive a slug from the name that is unique within the author's namespace
 * (slugs are per-author), ignoring `excludeId` (for updates).
 */
const resolveUniqueSlug = async (
	db: Database,
	name: string,
	authorId: string,
	excludeId?: string,
): Promise<string> => {
	const base = slugify(name) || "workspace";
	let candidate = base;
	let suffix = 1;

	const isTaken = async (slug: string): Promise<boolean> => {
		const matchers = [eq(aiScribeWorkspace.slug, slug), eq(aiScribeWorkspace.authorId, authorId)];
		if (excludeId) {
			matchers.push(ne(aiScribeWorkspace.id, excludeId));
		}
		const existing = await db.query.aiScribeWorkspace.findFirst({
			columns: { id: true },
			where: and(...matchers),
		});
		return Boolean(existing);
	};

	while (await isTaken(candidate)) {
		suffix += 1;
		candidate = `${base}-${suffix}`;
	}
	return candidate;
};

/**
 * For every slot that has a form selected, ensure it is an existing global AI
 * Vorlage whose prompt harness produces that slot's section (e.g. the Diagnosen
 * slot only accepts a form whose harness targets `diagnoseblock`). Empty slots
 * are allowed — they fall back to the standard template.
 */
const assertFormSlots = async (
	db: Database,
	slotFormIds: Record<(typeof SLOTS)[number]["key"], string | null>,
): Promise<void> => {
	const selectedIds = Object.values(slotFormIds).filter((id): id is string => id !== null);
	if (selectedIds.length === 0) {
		return;
	}

	const rows = await db.query.aiScribeFormConfig.findMany({
		columns: { id: true, promptHarness: true },
		where: and(
			isNull(aiScribeFormConfig.authorId),
			inArray(aiScribeFormConfig.id, [...new Set(selectedIds)]),
		),
	});
	const harnessById = new Map(rows.map((row) => [row.id, row.promptHarness]));

	for (const slot of SLOTS) {
		const formId = slotFormIds[slot.key];
		if (!formId) {
			continue;
		}
		const harness = harnessById.get(formId);
		if (!harness) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Die AI Vorlage für „${slot.label}“ existiert nicht.`,
			});
		}
		if (getPromptHarnessTargetField(harness) !== slot.field) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Die AI Vorlage für „${slot.label}“ passt nicht zu diesem Abschnitt.`,
			});
		}
	}
};

const toNullableText = (value?: string | null): string | null => {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
};

/** Saving a private workspace requires the Plus entitlement. */
const ensureCanSavePrivateWorkspace = async (
	db: Database,
	userId: string,
	visibility: ScribeFormVisibility,
): Promise<void> => {
	if (visibility === "public") {
		return;
	}
	const entitlements = await resolveProductEntitlements({ db, userId });
	if (!entitlements.canCreatePrivateAiScribeForms) {
		throw new ORPCError("FORBIDDEN", {
			message: USER_MESSAGES.privateAiScribeWorkspaceRequiresPlus,
		});
	}
};

const listHandler = authed.use(requiredAdminMiddleware).handler(({ context }) =>
	context.db.query.aiScribeWorkspace.findMany({
		orderBy: (workspace, { asc }) => [asc(workspace.createdAt)],
	}),
);

const createHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.input<typeof createWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createWorkspaceInput, input);
		await ensureCanSavePrivateWorkspace(context.db, context.session.user.id, parsed.visibility);
		const slotForms = {
			anamneseFormId: toNullableText(parsed.anamneseFormId),
			diagnosisFormId: toNullableText(parsed.diagnosisFormId),
			epikriseFormId: toNullableText(parsed.epikriseFormId),
		};
		await assertFormSlots(context.db, slotForms);

		const [created] = await context.db
			.insert(aiScribeWorkspace)
			.values({
				...slotForms,
				authorId: context.session.user.id,
				description: toNullableText(parsed.description),
				enabled: parsed.enabled,
				name: parsed.name,
				slug: await resolveUniqueSlug(context.db, parsed.name, context.session.user.id),
				visibility: parsed.visibility,
			})
			.returning();
		return created;
	});

const updateHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.input<typeof updateWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(updateWorkspaceInput, input);
		await ensureCanSavePrivateWorkspace(context.db, context.session.user.id, parsed.visibility);
		const slotForms = {
			anamneseFormId: toNullableText(parsed.anamneseFormId),
			diagnosisFormId: toNullableText(parsed.diagnosisFormId),
			epikriseFormId: toNullableText(parsed.epikriseFormId),
		};
		await assertFormSlots(context.db, slotForms);

		// Slugs are per-author, so dedupe within the existing row's author namespace.
		const existing = await context.db.query.aiScribeWorkspace.findFirst({
			columns: { authorId: true },
			where: eq(aiScribeWorkspace.id, parsed.id),
		});
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}

		const [updated] = await context.db
			.update(aiScribeWorkspace)
			.set({
				...slotForms,
				description: toNullableText(parsed.description),
				enabled: parsed.enabled,
				name: parsed.name,
				slug: await resolveUniqueSlug(
					context.db,
					parsed.name,
					existing.authorId ?? context.session.user.id,
					parsed.id,
				),
				visibility: parsed.visibility,
			})
			.where(eq(aiScribeWorkspace.id, parsed.id))
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}
		return updated;
	});

const deleteHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof deleteWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(deleteWorkspaceInput, input);
		await context.db.delete(aiScribeWorkspace).where(eq(aiScribeWorkspace.id, parsed.id));
		return { id: parsed.id };
	});

export const aiScribeWorkspacesHandler = {
	create: createHandler,
	delete: deleteHandler,
	list: listHandler,
	update: updateHandler,
};
