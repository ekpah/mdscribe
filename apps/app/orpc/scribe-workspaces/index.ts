import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	eq,
	inArray,
	isNull,
	or,
	user,
} from "@repo/database";
import type { AiScribeWorkspace, Database } from "@repo/database";

import { authed } from "@/orpc";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

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
	getBySlug: getBySlugHandler,
	getByUsernameSlug: getByUsernameSlugHandler,
	listAvailable: listAvailableHandler,
};
