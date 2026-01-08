import { and, asc, eq, textSnippet } from "@repo/database";
import { z } from "zod";

import { authed } from "@/orpc";

const getSnippetByIDHandler = authed
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ context, input }) => {
		const [snippet] = await context.db
			.select()
			.from(textSnippet)
			.where(
				and(
					eq(textSnippet.id, input.id),
					eq(textSnippet.userId, context.session.user.id),
				),
			)
			.limit(1);
		return snippet ?? null;
	});

// Get all snippets for the current user
const listSnippetsHandler = authed.handler(async ({ context }) => {
	const snippets = await context.db
		.select()
		.from(textSnippet)
		.where(eq(textSnippet.userId, context.session.user.id))
		.orderBy(asc(textSnippet.key));

	return snippets;
});

// Create a new snippet
const createSnippetHandler = authed
	.input(
		z.object({
			key: z.string().min(1).max(50),
			snippet: z.string().min(1).max(5000),
		}),
	)
	.handler(async ({ context, input }) => {
		const [snippet] = await context.db
			.insert(textSnippet)
			.values({
				userId: context.session.user.id,
				key: input.key,
				snippet: input.snippet,
			})
			.returning();

		return snippet;
	});

// Update an existing snippet
const updateSnippetHandler = authed
	.input(
		z.object({
			id: z.string(),
			key: z.string().min(1).max(50),
			snippet: z.string().min(1).max(5000),
		}),
	)
	.handler(async ({ context, input }) => {
		// Verify the snippet belongs to the user
		const [existing] = await context.db
			.select()
			.from(textSnippet)
			.where(
				and(
					eq(textSnippet.id, input.id),
					eq(textSnippet.userId, context.session.user.id),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Snippet not found");
		}

		const [snippet] = await context.db
			.update(textSnippet)
			.set({
				key: input.key,
				snippet: input.snippet,
			})
			.where(eq(textSnippet.id, input.id))
			.returning();

		return snippet;
	});

// Delete a snippet
const deleteSnippetHandler = authed
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ context, input }) => {
		// Verify the snippet belongs to the user
		const [existing] = await context.db
			.select()
			.from(textSnippet)
			.where(
				and(
					eq(textSnippet.id, input.id),
					eq(textSnippet.userId, context.session.user.id),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Snippet not found");
		}

		await context.db.delete(textSnippet).where(eq(textSnippet.id, input.id));

		return { success: true };
	});

export const snippetsHandler = {
	get: getSnippetByIDHandler,
	list: listSnippetsHandler,
	create: createSnippetHandler,
	update: updateSnippetHandler,
	delete: deleteSnippetHandler,
};
