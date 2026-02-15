import "server-only";

import { count, database, desc, eq, favourites, template } from "@repo/database";

const MAX_SUGGESTIONS = 10;

const addCategories = (
	target: string[],
	seen: Set<string>,
	categories: string[],
	limit: number,
) => {
	for (const category of categories) {
		const normalized = category.trim();
		if (!normalized) {
			continue;
		}

		const key = normalized.toLowerCase();
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		target.push(normalized);
		if (target.length >= limit) {
			return;
		}
	}
};

export async function getTemplateCategorySuggestions(
	userId: string,
	limit = MAX_SUGGESTIONS,
) {
	if (!userId || limit <= 0) {
		return [] as string[];
	}

	const suggestions: string[] = [];
	const seen = new Set<string>();

	const authoredCategories = await database
		.select({ category: template.category })
		.from(template)
		.where(eq(template.authorId, userId))
		.groupBy(template.category)
		.orderBy(desc(count()))
		.limit(limit);

	addCategories(
		suggestions,
		seen,
		authoredCategories.map((item) => item.category),
		limit,
	);

	if (suggestions.length < limit) {
		const favouriteCategories = await database
			.select({ category: template.category })
			.from(favourites)
			.innerJoin(template, eq(favourites.templateId, template.id))
			.where(eq(favourites.userId, userId))
			.groupBy(template.category)
			.orderBy(desc(count()))
			.limit(limit);

		addCategories(
			suggestions,
			seen,
			favouriteCategories.map((item) => item.category),
			limit,
		);
	}

	if (suggestions.length < limit) {
		const allCategories = await database
			.select({ category: template.category })
			.from(template)
			.groupBy(template.category)
			.orderBy(desc(count()))
			.limit(limit);

		addCategories(
			suggestions,
			seen,
			allCategories.map((item) => item.category),
			limit,
		);
	}

	return suggestions;
}
