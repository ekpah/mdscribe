import "server-only";

import { QueryClient } from "@tanstack/react-query";
import { database, eq, template } from "@repo/database";
import { env } from "@repo/env";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { orpc } from "@/lib/orpc";
import { getTemplateCategorySuggestions } from "./category-suggestions";

export interface TemplateEditorData {
	cat: string;
	categorySuggestions: string[];
	tit: string;
	note: string;
	id?: string;
	canEditSource: boolean;
}

interface SessionUser {
	id: string;
	email: string;
}

const getSessionUserOrRedirect = async (): Promise<SessionUser> => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/");
	}

	return {
		id: session.user.id,
		email: session.user.email,
	};
};

const getCommonEditorData = async (user: SessionUser) => {
	const categorySuggestions = await getTemplateCategorySuggestions(user.id);

	return {
		categorySuggestions,
		canEditSource: user.email === env.ADMIN_EMAIL,
	};
};

async function fetchForkedTemplate(id: string) {
	const [doc] = await database
		.select()
		.from(template)
		.where(eq(template.id, id))
		.limit(1);
	return doc;
}

export async function getCreateTemplateEditorData({
	forkId,
}: {
	forkId?: string;
}): Promise<TemplateEditorData> {
	const user = await getSessionUserOrRedirect();
	const sharedData = await getCommonEditorData(user);
	const forkedTemplate = forkId ? await fetchForkedTemplate(forkId) : null;

	return {
		...sharedData,
		cat: forkedTemplate?.category || "",
		tit: forkedTemplate?.title || "",
		note: JSON.stringify(forkedTemplate?.content || ""),
	};
}

export async function getEditTemplateEditorData({
	id,
}: {
	id: string;
}): Promise<TemplateEditorData> {
	const user = await getSessionUserOrRedirect();
	const sharedData = await getCommonEditorData(user);
	const queryClient = new QueryClient();
	const doc = await queryClient.fetchQuery(
		orpc.templates.get.queryOptions({ input: { id } }),
	);

	if (!doc) {
		throw new Error("Document not found");
	}

	return {
		...sharedData,
		cat: doc.category || "",
		tit: doc.title || "",
		note: JSON.stringify(doc.content || ""),
		id,
	};
}
