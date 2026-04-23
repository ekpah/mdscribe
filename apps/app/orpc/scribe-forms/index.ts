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
		const [form] = await context.db
			.select({
				description: aiScribeFormConfig.description,
				enabled: aiScribeFormConfig.enabled,
				id: aiScribeFormConfig.id,
				name: aiScribeFormConfig.name,
				promptHarness: aiScribeFormConfig.promptHarness,
				slug: aiScribeFormConfig.slug,
			})
			.from(aiScribeFormConfig)
			.where(eq(aiScribeFormConfig.slug, input.slug))
			.limit(1);

		if (!form || !form.enabled) {
			return null;
		}

		return {
			description: form.description,
			id: form.id,
			name: form.name,
			promptHarness: form.promptHarness,
			slug: form.slug,
		};
	});

export const scribeFormsHandler = {
	getBySlug: getBySlugHandler,
	listAvailable: listAvailableHandler,
};
