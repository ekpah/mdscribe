// One-time conversion of AI Vorlagen (AiScribeFormConfig) and Brief-Baukästen
// (AiScribeWorkspace) into plain templates, run from Einstellungen → Modelle →
// AI Scribe.
//
// - Each form becomes a template with the form's id, so the old
//   `/aiscribe/custom/…` URLs redirect to it (`orpc/aiscribe-redirects.ts`).
//   Its content comes from the linked template, else from the default AI Scribe
//   collection's standard template for the form's harness, else from the
//   built-in fallback; the standard template's instructions carry the harness
//   rules that used to live in the prompt.
// - Each workspace becomes one template with the workspace's id and one
//   `{% section %}` per slot (Diagnosen, Anamnese, Befunde, Epikrise).
//
// Global entries have no author and go to the admin who runs the conversion.
// A converted entry only copies content its new author could already see, as
// the old AI Scribe pages checked on every open: a linked template or form made
// private by someone else falls back to the standard template.
// Entries already converted are skipped, so it can run again. It only runs
// once the AI Scribe collection holds every standard template it needs: the
// built-in fallbacks lack the harness instructions.
import { ORPCError } from "@orpc/server";
import {
	aiDefaults,
	and,
	eq,
	inArray,
	or,
	template,
	templateCollectionTemplate,
} from "@repo/database";
import type { Database } from "@repo/database";

import { resolveFallbackTemplateByContextKey } from "@/orpc/scribe/context/template/fallbacks";

interface TemplateSource {
	content: string;
	examples: string[];
	information: string;
}

/** The default-collection template that replaced each prompt harness. */
const STANDARD_TITLE_BY_HARNESS: Record<string, string> = {
	anamnese: "Anamnese",
	befunde: "Befunde",
	diagnosis: "Diagnosen",
	discharge: "Entlassbrief – Epikrise",
	epikrise: "Entlassbrief – Epikrise",
	"icu-transfer": "Intensiv-Verlegung – Epikrise",
	outpatient: "Notaufnahme/Ambulanz – Epikrise",
	procedures: "Eingriff – Prozedurbefund",
};

const WORKSPACE_SLOTS = [
	{ column: "diagnosisFormId", harness: "diagnosis", id: "diagnosen", title: "Diagnosen" },
	{ column: "anamneseFormId", harness: "anamnese", id: "anamnese", title: "Anamnese" },
	{ column: null, harness: "befunde", id: "befunde", title: "Befunde" },
	{ column: "epikriseFormId", harness: "epikrise", id: "epikrise", title: "Epikrise" },
] as const;

const joinBlocks = (...blocks: (string | null | undefined)[]) =>
	blocks
		.map((block) => block?.trim())
		.filter(Boolean)
		.join("\n\n");

const isVisibleTo = (
	entry: { authorId: string | null; visibility: string },
	userId: string,
): boolean => entry.visibility === "public" || entry.authorId === userId;

/** The AI Scribe collection's templates the converting admin can see, by title. */
const loadStandardTemplates = async (db: Database, ownerId: string) => {
	const rows = await db
		.select({
			content: template.content,
			examples: template.examples,
			information: template.information,
			title: template.title,
		})
		.from(aiDefaults)
		.innerJoin(
			templateCollectionTemplate,
			eq(templateCollectionTemplate.collectionId, aiDefaults.aiScribeCollectionId),
		)
		.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
		.where(
			and(
				eq(aiDefaults.id, "global"),
				or(eq(template.visibility, "public"), eq(template.authorId, ownerId)),
			),
		);
	return new Map(rows.map((row) => [row.title, row]));
};

export const convertAiScribeForms = async (
	db: Database,
	{ dryRun, ownerId }: { dryRun: boolean; ownerId: string },
) => {
	const forms = await db.query.aiScribeFormConfig.findMany({ with: { template: true } });
	const workspaces = await db.query.aiScribeWorkspace.findMany();
	const ids = [...forms, ...workspaces].map((entry) => entry.id);
	const converted =
		ids.length > 0
			? await db.select({ id: template.id }).from(template).where(inArray(template.id, ids))
			: [];
	const existing = new Set(converted.map((row) => row.id));
	const standards = await loadStandardTemplates(db, ownerId);

	const missingStandards = new Set<string>();
	const harnessSource = (harness: string): TemplateSource => {
		const title = STANDARD_TITLE_BY_HARNESS[harness] ?? "";
		const standard = standards.get(title);
		if (!standard) {
			missingStandards.add(title || harness);
		}
		const fallback = resolveFallbackTemplateByContextKey(harness);
		return {
			content: standard?.content ?? fallback?.content ?? "",
			examples: standard?.examples ?? fallback?.examples ?? [],
			information: standard?.information ?? fallback?.information ?? "",
		};
	};
	const formById = new Map(forms.map((form) => [form.id, form]));
	/** A form's content for a template owned by `authorId`. */
	const formSource = (form: (typeof forms)[number], authorId: string): TemplateSource => {
		const base = harnessSource(form.promptHarness);
		return form.template && isVisibleTo(form.template, authorId)
			? {
					content: form.template.content,
					examples: form.template.examples,
					information: joinBlocks(base.information, form.template.information),
				}
			: base;
	};

	const rows: (typeof template.$inferInsert)[] = [];
	for (const form of forms) {
		if (existing.has(form.id)) {
			continue;
		}
		const authorId = form.authorId ?? ownerId;
		const source = formSource(form, authorId);
		rows.push({
			...source,
			authorId,
			id: form.id,
			information: joinBlocks(form.description, source.information),
			title: form.name,
			// A disabled entry was hidden before; keep it out of the public library.
			visibility: form.enabled ? form.visibility : "private",
		});
	}
	for (const workspace of workspaces) {
		if (existing.has(workspace.id)) {
			continue;
		}
		const authorId = workspace.authorId ?? ownerId;
		const slots = WORKSPACE_SLOTS.map((slot) => {
			const form = slot.column ? formById.get(workspace[slot.column] ?? "") : undefined;
			// A Baukasten only ever used enabled forms its author could see.
			const usable =
				form?.enabled && (form.authorId === null || isVisibleTo(form, workspace.authorId ?? ""));
			return {
				...slot,
				source: usable ? formSource(form, authorId) : harnessSource(slot.harness),
			};
		});
		rows.push({
			authorId,
			content: slots
				.map(
					(slot) =>
						`{% section id="${slot.id}" title="${slot.title}" %}\n${slot.source.content.trim()}\n{% /section %}`,
				)
				.join("\n\n"),
			examples: [],
			id: workspace.id,
			information: joinBlocks(
				workspace.description,
				...slots.map((slot) =>
					slot.source.information.trim() ? `## ${slot.title}\n\n${slot.source.information}` : "",
				),
			),
			title: workspace.name,
			visibility: workspace.enabled ? workspace.visibility : "private",
		});
	}

	if (!dryRun && missingStandards.size > 0) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: `Standardvorlagen fehlen in der AI Scribe Sammlung: ${[...missingStandards].join(", ")}`,
		});
	}
	if (!dryRun && rows.length > 0) {
		await db.insert(template).values(rows);
	}
	return {
		entries: rows.map((row) => ({ id: row.id, title: row.title, visibility: row.visibility })),
		/** Standard template titles the AI Scribe collection lacks; conversion waits for them. */
		missingStandards: [...missingStandards],
	};
};
