// Path helpers for AI Vorlagen and Brief-Baukästen.
//
// Slugs are unique per namespace: global (author-less) entries use a flat path,
// user-owned entries are addressed by their author's username. Pass the author
// username (null/undefined for global entries) and the right URL is built.

export const buildCustomFormPath = (
	slug: string,
	authorUsername: string | null | undefined,
): string =>
	authorUsername ? `/aiscribe/custom/u/${authorUsername}/${slug}` : `/aiscribe/custom/${slug}`;

export const buildWorkspacePath = (
	slug: string,
	authorUsername: string | null | undefined,
): string =>
	authorUsername
		? `/aiscribe/workspace/u/${authorUsername}/${slug}`
		: `/aiscribe/workspace/${slug}`;
