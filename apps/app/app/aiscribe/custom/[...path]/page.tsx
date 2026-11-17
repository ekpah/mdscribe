import { redirectLegacyAiscribePath } from "@/app/aiscribe/_lib/legacy-redirect";

export default async function LegacyCustomPage(props: { params: Promise<{ path: string[] }> }) {
	const { path } = await props.params;
	return redirectLegacyAiscribePath("custom", path);
}
