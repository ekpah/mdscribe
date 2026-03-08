import { type } from "@orpc/server";
import { aiScribeFormConfig, asc, eq } from "@repo/database";

import { pub } from "@/orpc";

interface PublicScribeForm {
	description: string | null;
	id: string;
	name: string;
	slug: string;
}

const listAvailableHandler = pub
	.output(type<PublicScribeForm[]>())
	.handler(async ({ context }) => {
		return context.db
			.select({
				id: aiScribeFormConfig.id,
				slug: aiScribeFormConfig.slug,
				name: aiScribeFormConfig.name,
				description: aiScribeFormConfig.description,
			})
			.from(aiScribeFormConfig)
			.where(eq(aiScribeFormConfig.enabled, true))
			.orderBy(asc(aiScribeFormConfig.createdAt));
	});

const getBySlugHandler = pub
	.input(type<{ slug: string }>())
	.output(type<PublicScribeForm | null>())
	.handler(async ({ context, input }) => {
		const [form] = await context.db
			.select({
				id: aiScribeFormConfig.id,
				slug: aiScribeFormConfig.slug,
				name: aiScribeFormConfig.name,
				description: aiScribeFormConfig.description,
				enabled: aiScribeFormConfig.enabled,
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
			slug: form.slug,
		};
	});

export const scribeFormsHandler = {
	getBySlug: getBySlugHandler,
	listAvailable: listAvailableHandler,
};
