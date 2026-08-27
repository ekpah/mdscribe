import { notFound } from "next/navigation";

import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";
import { getAiscribeIsAdmin } from "@/app/aiscribe/_lib/access";
import { isBuiltInAiscribeOverrideSlug } from "@/lib/aiscribe-built-ins";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

export default async function CustomAiscribePage(props: PageProps<"/aiscribe/custom/[slug]">) {
	const { slug } = await props.params;
	if (isBuiltInAiscribeOverrideSlug(slug)) {
		notFound();
	}

	const queryClient = getQueryClient();
	const [form, isAdmin] = await Promise.all([
		queryClient.fetchQuery(
			orpc.scribeForms.getBySlug.queryOptions({
				input: { slug },
			}),
		),
		getAiscribeIsAdmin(),
	]);

	if (!form) {
		notFound();
	}

	return <CustomAiscribeClient form={form} isAdmin={isAdmin} mode="custom" />;
}
