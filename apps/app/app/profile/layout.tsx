import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";

import { ProfileSettingsShell } from "./_components/profile-settings-shell";

interface ProfileLayoutProps {
	readonly children: ReactNode;
}

export default async function ProfileLayout({ children }: ProfileLayoutProps) {
	const requestHeaders = await headers();
	const session = await getServerSession().catch(() => null);

	if (!session?.user) {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/profile/account")));
	}

	return <ProfileSettingsShell>{children}</ProfileSettingsShell>;
}
