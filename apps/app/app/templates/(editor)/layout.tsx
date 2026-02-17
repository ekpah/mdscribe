import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type React from "react";
import { auth } from "@/auth";

export default async function EditorLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/");
	}

	return children;
}
