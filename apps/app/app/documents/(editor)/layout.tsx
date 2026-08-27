import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";

import { auth } from "@/auth";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({
		headers: requestHeaders,
	});

	if (!session?.user) {
		const requestedPath = getRequestedPath(requestHeaders, "/documents/create");
		redirect(createSignInRedirect(requestedPath));
	}

	return children;
}
