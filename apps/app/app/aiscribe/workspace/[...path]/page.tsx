import { redirectLegacyAiscribePath } from "@/app/aiscribe/_lib/legacy-redirect";

export default async function LegacyWorkspacePage(props: { params: Promise<{ path: string[] }> }) {
	const { path } = await props.params;
	return redirectLegacyAiscribePath("workspace", path);
}
