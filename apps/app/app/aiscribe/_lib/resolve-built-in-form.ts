import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import type { PublicAiTextForm } from "./custom-form-config";
import {
	getBuiltInAiscribeOverrideSlug,
	type BuiltInAiscribeTemplateKey,
} from "./built-in-form-config";

export const resolveBuiltInAiscribeOverrideForm = async (
	template: BuiltInAiscribeTemplateKey,
): Promise<PublicAiTextForm | null> => {
	const queryClient = getQueryClient();
	return queryClient.fetchQuery(
		orpc.scribeForms.getBySlug.queryOptions({
			input: {
				slug: getBuiltInAiscribeOverrideSlug(template),
			},
		}),
	);
};
