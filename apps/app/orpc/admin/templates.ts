import { ORPCError } from "@orpc/server";
import {
	aiDefaults,
	and,
	desc,
	eq,
	template,
	templateCollection,
	templateCollectionTemplate,
	user,
} from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";
import standardTemplates from "@/orpc/admin/ai-scribe-standard-templates.json";
import { convertAiScribeForms } from "@/orpc/admin/convert-ai-scribe-forms";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";

const getAdminTemplateHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const [templateData] = await context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				authorId: template.authorId,
				content: template.content,
				examples: template.examples,
				id: template.id,
				information: template.information,
				title: template.title,
				updatedAt: template.updatedAt,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.where(eq(template.id, input.id))
			.limit(1);

		return templateData ?? null;
	});

const listAdminTemplatesHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const templates = await context.db
			.select({
				author: {
					email: user.email,
					id: user.id,
					name: user.name,
				},
				authorId: template.authorId,
				id: template.id,
				title: template.title,
				updatedAt: template.updatedAt,
				visibility: template.visibility,
			})
			.from(template)
			.leftJoin(user, eq(template.authorId, user.id))
			.orderBy(desc(template.updatedAt));

		return templates.map((item) => ({
			...item,
			isAuthored: item.authorId === context.session.user.id,
		}));
	});

const getAiScribeCollectionHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const [row] = await context.db
			.select({ collectionId: aiDefaults.aiScribeCollectionId })
			.from(aiDefaults)
			.where(eq(aiDefaults.id, "global"));
		return { collectionId: row?.collectionId ?? null };
	});

/** Picks one of the admin's own collections as the default list on `/aiscribe`. */
const setAiScribeCollectionHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ collectionId: z.string().nullable() }))
	.handler(async ({ context, input }) => {
		if (input.collectionId) {
			const [owned] = await context.db
				.select({ id: templateCollection.id })
				.from(templateCollection)
				.where(
					and(
						eq(templateCollection.id, input.collectionId),
						eq(templateCollection.userId, context.session.user.id),
					),
				);
			if (!owned) {
				throw new ORPCError("NOT_FOUND", { message: "Sammlung wurde nicht gefunden" });
			}
		}
		await context.db
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: input.collectionId, id: "global", updatedAt: new Date() })
			.onConflictDoUpdate({
				set: { aiScribeCollectionId: input.collectionId, updatedAt: new Date() },
				target: aiDefaults.id,
			});
		return { collectionId: input.collectionId };
	});

const STANDARD_COLLECTION_NAME = "AI Scribe Standard";

/**
 * Creates the AI Scribe standard templates once: a public template each, in a new collection of
 * the admin's that becomes the AI Scribe collection. Refuses while an AI Scribe collection is
 * chosen or the admin already has a collection of that name, so a second click adds no copies.
 */
const createAiScribeStandardHandler = authed.use(requiredAdminMiddleware).handler(({ context }) =>
	context.db.transaction(async (tx) => {
		const ownerId = context.session.user.id;
		const [defaults] = await tx
			.select({ collectionId: aiDefaults.aiScribeCollectionId })
			.from(aiDefaults)
			.where(eq(aiDefaults.id, "global"));
		const [existing] = await tx
			.select({ id: templateCollection.id })
			.from(templateCollection)
			.where(
				and(
					eq(templateCollection.userId, ownerId),
					eq(templateCollection.name, STANDARD_COLLECTION_NAME),
				),
			);
		if (defaults?.collectionId || existing) {
			throw new ORPCError("CONFLICT", {
				message: "Die AI Scribe Standardvorlagen sind bereits angelegt.",
			});
		}

		const now = new Date();
		const [collection] = await tx
			.insert(templateCollection)
			.values({
				description:
					"Standard-Templates für AI Scribe: je Abschnitt ein in sich geschlossenes Template.",
				name: STANDARD_COLLECTION_NAME,
				updatedAt: now,
				userId: ownerId,
			})
			.returning({ id: templateCollection.id });
		if (!collection) {
			throw new Error("Sammlung konnte nicht erstellt werden");
		}
		const created = await tx
			.insert(template)
			.values(
				standardTemplates.map((standard) => ({
					authorId: ownerId,
					content: standard.content,
					information: standard.information,
					title: standard.title,
					updatedAt: now,
					visibility: "public",
				})),
			)
			.returning({ id: template.id });
		await tx
			.insert(templateCollectionTemplate)
			.values(created.map(({ id }) => ({ collectionId: collection.id, templateId: id })));
		await tx
			.insert(aiDefaults)
			.values({ aiScribeCollectionId: collection.id, id: "global", updatedAt: now })
			.onConflictDoUpdate({
				set: { aiScribeCollectionId: collection.id, updatedAt: now },
				target: aiDefaults.id,
			});
		return { collectionId: collection.id, created: created.length };
	}),
);

/** Converts the remaining AI Vorlagen and Brief-Baukästen; `dryRun` only lists them. */
const convertAiScribeFormsHandler = authed
	.use(requiredAdminMiddleware)
	.input(z.object({ dryRun: z.boolean() }))
	.handler(({ context, input }) =>
		convertAiScribeForms(context.db, { dryRun: input.dryRun, ownerId: context.session.user.id }),
	);

export const templatesHandler = {
	aiScribeCollection: getAiScribeCollectionHandler,
	convertAiScribeForms: convertAiScribeFormsHandler,
	createAiScribeStandard: createAiScribeStandardHandler,
	get: getAdminTemplateHandler,
	list: listAdminTemplatesHandler,
	setAiScribeCollection: setAiScribeCollectionHandler,
};
