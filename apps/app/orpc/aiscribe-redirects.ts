// Old AI Scribe URLs, kept working after AI Vorlagen and Brief-Baukästen became
// templates. `orpc/admin/convert-ai-scribe-forms.ts` gives each converted template
// the id of its form or workspace, so a slug resolves through the old tables.
// Only templates the caller can see resolve, so the route reveals no private
// entry. Remove together with those tables.
import {
	aiDefaults,
	aiScribeFormConfig,
	aiScribeWorkspace,
	and,
	eq,
	isNull,
	or,
	template,
	templateCollectionTemplate,
	user,
} from "@repo/database";
import type { Database } from "@repo/database";
import { z } from "zod";

import { pub } from "@/orpc";
import { getOptionalUserId } from "@/orpc/middlewares/auth";

const visibleTo = (userId: string | null) =>
	userId
		? or(eq(template.visibility, "public"), eq(template.authorId, userId))
		: eq(template.visibility, "public");

/** The built-in modes and the default-collection template that replaced each. */
export const LEGACY_BUILT_IN_TITLES: Record<string, string> = {
	diagnoseblock: "Diagnosen",
	discharge: "Entlassbrief – Epikrise",
	er: "Anamnese",
	icu: "Intensiv-Verlegung – Epikrise",
	outpatient: "Notaufnahme/Ambulanz – Epikrise",
	procedures: "Eingriff – Prozedurbefund",
};

const resolveBuiltIn = async (db: Database, userId: string | null, key: string) => {
	const title = Object.hasOwn(LEGACY_BUILT_IN_TITLES, key) ? LEGACY_BUILT_IN_TITLES[key] : null;
	if (!title) {
		return null;
	}
	const [row] = await db
		.select({ id: template.id })
		.from(aiDefaults)
		.innerJoin(
			templateCollectionTemplate,
			eq(templateCollectionTemplate.collectionId, aiDefaults.aiScribeCollectionId),
		)
		.innerJoin(template, eq(templateCollectionTemplate.templateId, template.id))
		.where(and(eq(aiDefaults.id, "global"), eq(template.title, title), visibleTo(userId)))
		.limit(1);
	return row?.id ?? null;
};

/** `path` is the rest of the URL: `[slug]` for a global entry or `["u", username, slug]`. */
const resolveSlug = async (
	db: Database,
	userId: string | null,
	kind: "custom" | "workspace",
	path: string[],
) => {
	const [slug, username] = path[0] === "u" ? [path[2], path[1]] : [path[0], undefined];
	const author = username
		? await db.query.user.findFirst({ columns: { id: true }, where: eq(user.username, username) })
		: null;
	if (!slug || (username && !author)) {
		return null;
	}
	const table = kind === "custom" ? aiScribeFormConfig : aiScribeWorkspace;
	const [row] = await db
		.select({ id: template.id })
		.from(table)
		.innerJoin(template, eq(template.id, table.id))
		.where(
			and(
				eq(table.slug, slug),
				author ? eq(table.authorId, author.id) : isNull(table.authorId),
				visibleTo(userId),
			),
		)
		.limit(1);
	return row?.id ?? null;
};

export const resolveAiscribeRedirectHandler = pub
	.input(
		z.object({
			kind: z.enum(["builtin", "custom", "workspace"]),
			path: z.array(z.string()).min(1).max(3),
		}),
	)
	.handler(async ({ context, input }) => {
		const userId = await getOptionalUserId(context);
		return {
			templateId:
				input.kind === "builtin"
					? await resolveBuiltIn(context.db, userId, input.path[0] ?? "")
					: await resolveSlug(context.db, userId, input.kind, input.path),
		};
	});
