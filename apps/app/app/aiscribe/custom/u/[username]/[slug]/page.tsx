import { notFound } from "next/navigation";

import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";
import { getAiscribeIsAdmin } from "@/app/aiscribe/_lib/access";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

export default async function CustomUserAiscribePage(
	props: PageProps<"/aiscribe/custom/u/[username]/[slug]">,
) {
	const { slug, username } = await props.params;

	const queryClient = getQueryClient();
	const [form, isAdmin] = await Promise.all([
		queryClient.fetchQuery(
			orpc.scribeForms.getByUsernameSlug.queryOptions({
				input: { slug, username },
			}),
		),
		getAiscribeIsAdmin(),
	]);

	if (!form) {
		notFound();
	}

	return <CustomAiscribeClient form={form} isAdmin={isAdmin} mode="custom" />;
}
