import { env } from "@repo/env";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";

import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";

export default async function Layout({ children }: { children: React.ReactNode }) {
	const requestHeaders = await headers();
	const session = await getServerSession();

	if (!session?.user) {
		const requestedPath = getRequestedPath(requestHeaders, "/documents");
		redirect(createSignInRedirect(requestedPath));
	}

	// Document templates are still in development and gated to admin users right now.
	if (session.user.email !== env.ADMIN_EMAIL) {
		redirect("/");
	}

	return children;
}
