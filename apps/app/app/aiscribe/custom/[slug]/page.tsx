import { notFound } from "next/navigation";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import { isBuiltInAiscribeOverrideSlug } from "@/lib/aiscribe-built-ins";
import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";

export default async function CustomAiscribePage(
	props: PageProps<"/aiscribe/custom/[slug]">,
) {
	const { slug } = await props.params;
	if (isBuiltInAiscribeOverrideSlug(slug)) {
		notFound();
	}

	const queryClient = getQueryClient();
	const form = await queryClient.fetchQuery(
		orpc.scribeForms.getBySlug.queryOptions({
			input: { slug },
		}),
	);

	if (!form) {
		notFound();
	}

	return <CustomAiscribeClient form={form} mode="custom" />;
}
