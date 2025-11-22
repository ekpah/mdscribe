import { z } from 'zod';
import { authed } from '@/orpc';

const getSnippetByIDHandler = authed
  .input(
    z.object({
      id: z.string(),
    })
  )
  .handler(async ({ context, input }) => {
    const snippet = await context.db.textSnippet.findFirst({
      where: {
        id: input.id,
        userId: context.session.user.id,
      },
    });
    return snippet;
  });

// Get all snippets for the current user
const listSnippetsHandler = authed.handler(async ({ context }) => {
  const snippets = await context.db.textSnippet.findMany({
    where: {
      userId: context.session.user.id,
    },
    orderBy: {
      key: 'asc',
    },
  });

  return snippets;
});

// Create a new snippet
const createSnippetHandler = authed
  .input(
    z.object({
      key: z.string().min(1).max(50),
      snippet: z.string().min(1).max(5000),
    })
  )
  .handler(async ({ context, input }) => {
    const snippet = await context.db.textSnippet.create({
      data: {
        userId: context.session.user.id,
        key: input.key,
        snippet: input.snippet,
      },
    });

    return snippet;
  });

// Update an existing snippet
const updateSnippetHandler = authed
  .input(
    z.object({
      id: z.string(),
      key: z.string().min(1).max(50),
      snippet: z.string().min(1).max(5000),
    })
  )
  .handler(async ({ context, input }) => {
    // Verify the snippet belongs to the user
    const existing = await context.db.textSnippet.findFirst({
      where: {
        id: input.id,
        userId: context.session.user.id,
      },
    });

    if (!existing) {
      throw new Error('Snippet not found');
    }

    const snippet = await context.db.textSnippet.update({
      where: {
        id: input.id,
      },
      data: {
        key: input.key,
        snippet: input.snippet,
      },
    });

    return snippet;
  });

// Delete a snippet
const deleteSnippetHandler = authed
  .input(
    z.object({
      id: z.string(),
    })
  )
  .handler(async ({ context, input }) => {
    // Verify the snippet belongs to the user
    const existing = await context.db.textSnippet.findFirst({
      where: {
        id: input.id,
        userId: context.session.user.id,
      },
    });

    if (!existing) {
      throw new Error('Snippet not found');
    }

    await context.db.textSnippet.delete({
      where: {
        id: input.id,
      },
    });

    return { success: true };
  });

export const snippetsHandler = {
  get: getSnippetByIDHandler,
  list: listSnippetsHandler,
  create: createSnippetHandler,
  update: updateSnippetHandler,
  delete: deleteSnippetHandler,
};
