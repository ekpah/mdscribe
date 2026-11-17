import { redirect } from "next/navigation";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

/** Sends an old AI Scribe URL to the template that replaced it, or to the overview. */
export const redirectLegacyAiscribePath = async (
	kind: "builtin" | "custom" | "workspace",
	path: string[],
): Promise<never> => {
	const { templateId } = await getQueryClient().fetchQuery(
		orpc.aiscribeRedirect.queryOptions({ input: { kind, path } }),
	);
	redirect(templateId ? `/aiscribe/${templateId}` : "/aiscribe");
};
