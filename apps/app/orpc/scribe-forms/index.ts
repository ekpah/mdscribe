import { type } from "@orpc/server";
import { aiScribeFormConfig, and, asc, eq, notInArray } from "@repo/database";
import { BUILT_IN_AISCRIBE_OVERRIDE_SLUGS } from "@/lib/aiscribe-built-ins";

import { pub } from "@/orpc";

interface PublicScribeForm {
	description: string | null;
	id: string;
	name: string;
	promptHarness: string;
	slug: string;
	template?: {
		id: string;
		title: string;
	} | null;
}

const listAvailableHandler = pub
	.output(type<PublicScribeForm[]>())
	.handler(({ context }) => context.db
				.select({
					description: aiScribeFormConfig.description,
					id: aiScribeFormConfig.id,
					name: aiScribeFormConfig.name,
					promptHarness: aiScribeFormConfig.promptHarness,
					slug: aiScribeFormConfig.slug,
			})
			.from(aiScribeFormConfig)
			.where(
				and(
					eq(aiScribeFormConfig.enabled, true),
					notInArray(aiScribeFormConfig.slug, BUILT_IN_AISCRIBE_OVERRIDE_SLUGS),
				),
			)
			.orderBy(asc(aiScribeFormConfig.createdAt)));

const getBySlugHandler = pub
	.input(type<{ slug: string }>())
	.output(type<PublicScribeForm | null>())
	.handler(async ({ context, input }) => {
		const form = await context.db.query.aiScribeFormConfig.findFirst({
			columns: {
				description: true,
				enabled: true,
				id: true,
				name: true,
				promptHarness: true,
				slug: true,
			},
			where: eq(aiScribeFormConfig.slug, input.slug),
			with: {
				template: {
					columns: {
						id: true,
						title: true,
					},
				},
			},
		});

		if (!form || !form.enabled) {
			return null;
		}

		return {
			description: form.description,
			id: form.id,
			name: form.name,
			promptHarness: form.promptHarness,
			slug: form.slug,
			template: form.template,
		};
	});

export const scribeFormsHandler = {
	getBySlug: getBySlugHandler,
	listAvailable: listAvailableHandler,
};
