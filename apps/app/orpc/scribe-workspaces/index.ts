import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	eq,
	inArray,
	isNull,
	ne,
	notInArray,
	or,
	user,
} from "@repo/database";
import type { AiScribeWorkspace, Database } from "@repo/database";
import { z } from "zod";

import { BUILT_IN_AISCRIBE_OVERRIDE_SLUGS } from "@/lib/aiscribe-built-ins";
import { resolveProductEntitlements } from "@/lib/product-entitlements";
import { USER_MESSAGES } from "@/lib/user-messages";
import { authed } from "@/orpc";
import {
	getPromptHarnessTargetField,
	resolvePromptHarnessId,
} from "@/orpc/scribe/prompts";
import type { CanonicalContextField, PromptHarnessId } from "@/orpc/scribe/prompts";
import {
	parseWithBadRequest,
	scribeFormVisibilitySchema,
} from "@/orpc/scribe-forms/shared";
import type { ScribeFormVisibility } from "@/orpc/scribe-forms/shared";

interface ResolvedWorkspaceSection {
	key: string;
	label: string;
	harness: PromptHarnessId;
	formId: string | null;
	templateId: string | null;
}

// Section order + which workspace column drives each. Befunde always defaults.
const SECTION_BLUEPRINT = [
	{ formColumn: "diagnosisFormId", harness: "diagnosis", key: "diagnosis", label: "Diagnosen" },
	{ formColumn: "anamneseFormId", harness: "anamnese", key: "anamnese", label: "Anamnese" },
	{ formColumn: null, harness: "befunde", key: "befunde", label: "Befunde" },
	{ formColumn: "epikriseFormId", harness: "epikrise", key: "epikrise", label: "Epikrise" },
] as const satisfies readonly {
	formColumn: "anamneseFormId" | "diagnosisFormId" | "epikriseFormId" | null;
	harness: PromptHarnessId;
	key: string;
	label: string;
}[];

const visibleToUser = (userId: string) =>
	or(
		eq(aiScribeWorkspace.visibility, "public"),
		eq(aiScribeWorkspace.authorId, userId),
	);

const visibleFormToUser = (userId: string) =>
	or(eq(aiScribeFormConfig.visibility, "public"), eq(aiScribeFormConfig.authorId, userId));

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

const FORM_SLOTS = [
	{ field: "diagnoseblock", key: "diagnosisFormId", label: "Diagnosen" },
	{ field: "anamnese", key: "anamneseFormId", label: "Anamnese" },
	{ field: "epikrise", key: "epikriseFormId", label: "Epikrise" },
] as const satisfies readonly {
	field: CanonicalContextField;
	key: "anamneseFormId" | "diagnosisFormId" | "epikriseFormId";
	label: string;
}[];

const COMBINING_MARKS = /[\u0300-\u036F]/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

const slugifyWorkspaceName = (value: string): string =>
	value
		.toLowerCase()
		.normalize("NFKD")
		.replaceAll(COMBINING_MARKS, "")
		.replaceAll(NON_SLUG_CHARS, "-")
		.replaceAll(EDGE_DASHES, "");

const toNullableText = (value?: string | null): string | null => {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
};

const resolveUniqueSlug = async ({
	authorId,
	db,
	excludeId,
	name,
}: {
	authorId: string;
	db: Database;
	excludeId?: string;
	name: string;
}): Promise<string> => {
	const base = slugifyWorkspaceName(name) || "brief-baukasten";
	let candidate = base;
	let suffix = 1;

	const isTaken = async (slug: string): Promise<boolean> => {
		const matchers = [
			eq(aiScribeWorkspace.slug, slug),
			eq(aiScribeWorkspace.authorId, authorId),
		];
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

const ensureCanSavePrivateWorkspace = async ({
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
			message: USER_MESSAGES.privateAiScribeWorkspaceRequiresPlus,
		});
	}
};

const assertVisibleFormSlots = async ({
	db,
	slotFormIds,
	userId,
}: {
	db: Database;
	slotFormIds: Record<(typeof FORM_SLOTS)[number]["key"], string | null>;
	userId: string;
}): Promise<void> => {
	const selectedIds = Object.values(slotFormIds).filter(
		(id): id is string => id !== null,
	);
	if (selectedIds.length === 0) {
		return;
	}

	const rows = await db.query.aiScribeFormConfig.findMany({
		columns: { id: true, promptHarness: true },
		where: and(
			eq(aiScribeFormConfig.enabled, true),
			inArray(aiScribeFormConfig.id, [...new Set(selectedIds)]),
			visibleFormToUser(userId),
		),
	});
	const harnessById = new Map(rows.map((row) => [row.id, row.promptHarness]));

	for (const slot of FORM_SLOTS) {
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

const toWorkspaceSlotValues = (input: {
	anamneseFormId?: string | null;
	diagnosisFormId?: string | null;
	epikriseFormId?: string | null;
}) => ({
	anamneseFormId: toNullableText(input.anamneseFormId),
	diagnosisFormId: toNullableText(input.diagnosisFormId),
	epikriseFormId: toNullableText(input.epikriseFormId),
});

const resolveSections = (
	workspace: AiScribeWorkspace,
	formsById: Map<string, { id: string; promptHarness: string; templateId: string | null }>,
): ResolvedWorkspaceSection[] =>
	SECTION_BLUEPRINT.map((slot) => {
		const formId = slot.formColumn ? workspace[slot.formColumn] : null;
		const form = formId ? formsById.get(formId) : undefined;
		const harness = form ? resolvePromptHarnessId(form.promptHarness) : undefined;
		// Use the form only when it is still usable and resolves to a harness.
		if (form && harness) {
			return {
				formId: form.id,
				harness,
				key: slot.key,
				label: slot.label,
				templateId: form.templateId,
			};
		}
		return {
			formId: null,
			harness: slot.harness,
			key: slot.key,
			label: slot.label,
			templateId: null,
		};
	});

/** Resolve a workspace's referenced forms (visible to the viewer) into sections. */
const resolveWorkspace = async (
	db: Database,
	workspace: AiScribeWorkspace,
	viewerId: string,
) => {
	const referencedFormIds = [
		workspace.diagnosisFormId,
		workspace.anamneseFormId,
		workspace.epikriseFormId,
	].filter((id): id is string => id !== null);

	const forms =
		referencedFormIds.length > 0
			? await db.query.aiScribeFormConfig.findMany({
					columns: { id: true, promptHarness: true, templateId: true },
					where: and(
						eq(aiScribeFormConfig.enabled, true),
						inArray(aiScribeFormConfig.id, referencedFormIds),
						or(
							eq(aiScribeFormConfig.visibility, "public"),
							eq(aiScribeFormConfig.authorId, viewerId),
						),
					),
				})
			: [];
	const formsById = new Map(forms.map((form) => [form.id, form]));

	return {
		description: workspace.description ?? "",
		sections: resolveSections(workspace, formsById),
		slug: workspace.slug,
		title: workspace.name,
	};
};

const listAvailableHandler = authed.handler(async ({ context }) => {
	const rows = await context.db.query.aiScribeWorkspace.findMany({
		columns: {
			authorId: true,
			description: true,
			id: true,
			name: true,
			slug: true,
		},
		orderBy: (workspace, { asc }) => [asc(workspace.name)],
		where: and(
			eq(aiScribeWorkspace.enabled, true),
			visibleToUser(context.session.user.id),
		),
		with: { author: { columns: { username: true } } },
	});
	return rows.map((row) => ({
		authorId: row.authorId,
		authorUsername: row.author?.username ?? null,
		description: row.description,
		id: row.id,
		name: row.name,
		slug: row.slug,
	}));
});

const listHandler = authed.handler(({ context }) =>
	context.db.query.aiScribeWorkspace.findMany({
		orderBy: (workspace, { asc }) => [asc(workspace.createdAt)],
		where: eq(aiScribeWorkspace.authorId, context.session.user.id),
	}),
);

const editorContextHandler = authed.handler(async ({ context }) => {
	const [forms, entitlements] = await Promise.all([
		context.db.query.aiScribeFormConfig.findMany({
			columns: {
				authorId: true,
				id: true,
				name: true,
				promptHarness: true,
			},
			orderBy: (form, { asc }) => [asc(form.authorId), asc(form.name)],
			where: and(
				eq(aiScribeFormConfig.enabled, true),
				notInArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
				visibleFormToUser(context.session.user.id),
			),
			with: {
				author: {
					columns: {
						name: true,
						username: true,
					},
				},
			},
		}),
		resolveProductEntitlements({
			db: context.db,
			userId: context.session.user.id,
		}),
	]);

	return {
		canCreatePrivateAiScribeForms: entitlements.canCreatePrivateAiScribeForms,
		forms: forms.map((form) => ({
			author: form.author,
			authorId: form.authorId,
			id: form.id,
			name: form.name,
			promptHarness: resolvePromptHarnessId(form.promptHarness) ?? form.promptHarness,
		})),
	};
});

const createHandler = authed
	.input(type<z.input<typeof createWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(createWorkspaceInput, input);
		await ensureCanSavePrivateWorkspace({
			db: context.db,
			userId: context.session.user.id,
			visibility: parsed.visibility,
		});
		const slotForms = toWorkspaceSlotValues(parsed);
		await assertVisibleFormSlots({
			db: context.db,
			slotFormIds: slotForms,
			userId: context.session.user.id,
		});

		const [created] = await context.db
			.insert(aiScribeWorkspace)
			.values({
				...slotForms,
				authorId: context.session.user.id,
				description: toNullableText(parsed.description),
				enabled: parsed.enabled,
				name: parsed.name,
				slug: await resolveUniqueSlug({
					authorId: context.session.user.id,
					db: context.db,
					name: parsed.name,
				}),
				visibility: parsed.visibility,
			})
			.returning();

		return created;
	});

const updateHandler = authed
	.input(type<z.input<typeof updateWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(updateWorkspaceInput, input);
		await ensureCanSavePrivateWorkspace({
			db: context.db,
			userId: context.session.user.id,
			visibility: parsed.visibility,
		});
		const slotForms = toWorkspaceSlotValues(parsed);
		await assertVisibleFormSlots({
			db: context.db,
			slotFormIds: slotForms,
			userId: context.session.user.id,
		});

		const [updated] = await context.db
			.update(aiScribeWorkspace)
			.set({
				...slotForms,
				description: toNullableText(parsed.description),
				enabled: parsed.enabled,
				name: parsed.name,
				slug: await resolveUniqueSlug({
					authorId: context.session.user.id,
					db: context.db,
					excludeId: parsed.id,
					name: parsed.name,
				}),
				visibility: parsed.visibility,
			})
			.where(
				and(
					eq(aiScribeWorkspace.id, parsed.id),
					eq(aiScribeWorkspace.authorId, context.session.user.id),
				),
			)
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}

		return updated;
	});

const deleteHandler = authed
	.input(type<z.input<typeof deleteWorkspaceInput>>())
	.handler(async ({ context, input }) => {
		const parsed = parseWithBadRequest(deleteWorkspaceInput, input);
		const [deleted] = await context.db
			.delete(aiScribeWorkspace)
			.where(
				and(
					eq(aiScribeWorkspace.id, parsed.id),
					eq(aiScribeWorkspace.authorId, context.session.user.id),
				),
			)
			.returning({ id: aiScribeWorkspace.id });

		if (!deleted) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}

		return { success: true };
	});

// Global (author-less) workspaces by slug.
const getBySlugHandler = authed
	.input(type<{ slug: string }>())
	.handler(async ({ context, input }) => {
		const workspace = await context.db.query.aiScribeWorkspace.findFirst({
			where: and(
				eq(aiScribeWorkspace.slug, input.slug),
				isNull(aiScribeWorkspace.authorId),
				eq(aiScribeWorkspace.enabled, true),
				visibleToUser(context.session.user.id),
			),
		});
		if (!workspace) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}
		return resolveWorkspace(context.db, workspace, context.session.user.id);
	});

// User-owned workspaces by author handle + slug.
const getByUsernameSlugHandler = authed
	.input(type<{ slug: string; username: string }>())
	.handler(async ({ context, input }) => {
		const author = await context.db.query.user.findFirst({
			columns: { id: true },
			where: eq(user.username, input.username),
		});
		if (!author) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}

		const workspace = await context.db.query.aiScribeWorkspace.findFirst({
			where: and(
				eq(aiScribeWorkspace.authorId, author.id),
				eq(aiScribeWorkspace.slug, input.slug),
				eq(aiScribeWorkspace.enabled, true),
				visibleToUser(context.session.user.id),
			),
		});
		if (!workspace) {
			throw new ORPCError("NOT_FOUND", {
				message: "Brief-Baukasten wurde nicht gefunden.",
			});
		}
		return resolveWorkspace(context.db, workspace, context.session.user.id);
	});

export const scribeWorkspacesHandler = {
	create: createHandler,
	delete: deleteHandler,
	editorContext: editorContextHandler,
	getBySlug: getBySlugHandler,
	getByUsernameSlug: getByUsernameSlugHandler,
	list: listHandler,
	listAvailable: listAvailableHandler,
	update: updateHandler,
};
