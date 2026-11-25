import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getServerSession } from "@/lib/server-session";

interface SignInLayoutProps {
	readonly children: ReactNode;
}

export default async function SignInLayout({ children }: SignInLayoutProps) {
	const session = await getServerSession().catch(() => null);

	if (session?.user) {
		redirect("/dashboard");
	}

	return children;
}
