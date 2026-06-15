import { ORPCError, type } from "@orpc/server";
import {
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	eq,
	inArray,
	or,
} from "@repo/database";
import type { AiScribeWorkspace } from "@repo/database";

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

const listAvailableHandler = authed.handler(async ({ context }) => {
	const rows = await context.db.query.aiScribeWorkspace.findMany({
		columns: { description: true, id: true, name: true, slug: true },
		orderBy: (workspace, { asc }) => [asc(workspace.name)],
		where: and(
			eq(aiScribeWorkspace.enabled, true),
			visibleToUser(context.session.user.id),
		),
	});
	return rows;
});

const getBySlugHandler = authed
	.input(type<{ slug: string }>())
	.handler(async ({ context, input }) => {
		const workspace = await context.db.query.aiScribeWorkspace.findFirst({
			where: and(
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

		const referencedFormIds = [
			workspace.diagnosisFormId,
			workspace.anamneseFormId,
			workspace.epikriseFormId,
		].filter((id): id is string => id !== null);

		const forms =
			referencedFormIds.length > 0
				? await context.db.query.aiScribeFormConfig.findMany({
						columns: { id: true, promptHarness: true, templateId: true },
						where: and(
							eq(aiScribeFormConfig.enabled, true),
							inArray(aiScribeFormConfig.id, referencedFormIds),
							or(
								eq(aiScribeFormConfig.visibility, "public"),
								eq(aiScribeFormConfig.authorId, context.session.user.id),
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
	});

export const scribeWorkspacesHandler = {
	getBySlug: getBySlugHandler,
	listAvailable: listAvailableHandler,
};
