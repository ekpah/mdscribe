import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";

import { AccountSettingsPage } from "../_components/account-settings-page";

export default async function ProfileAccountPage() {
	const requestHeaders = await headers();
	const [session, activeSessions, subscriptions] = await Promise.all([
		getServerSession(),
		auth.api.listSessions({
			headers: requestHeaders,
		}),
		auth.api.listActiveSubscriptions({
			headers: requestHeaders,
		}),
	]).catch(() => {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/profile/account")));
	});

	if (!session?.user) {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/profile/account")));
	}

	const activeSubscription = subscriptions.find(
		(subscription) => subscription.status === "active" || subscription.status === "trialing",
	);

	return (
		<AccountSettingsPage
			activeSessions={structuredClone(activeSessions)}
			session={structuredClone(session)}
			subscription={activeSubscription ? structuredClone(activeSubscription) : undefined}
			user={structuredClone(session.user)}
		/>
	);
}
