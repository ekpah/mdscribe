import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import { getBuiltInAiscribeOverrideSlug } from "./built-in-form-config";
import type { BuiltInAiscribeTemplateKey } from "./built-in-form-config";
import type { PublicAiTextForm } from "./custom-form-config";

export const resolveBuiltInAiscribeOverrideForm = (
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
