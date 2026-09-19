import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
import { getSessionDeviceInfo } from "@/lib/session-device";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";
import { subscriptionsEnabled } from "@/lib/stripe-config";
import { getActiveSubscription } from "@/lib/subscriptions";

import { AccountSettingsPage } from "../_components/account-settings-page";

export default async function ProfileAccountPage() {
	const requestHeaders = await headers();
	const [session, activeSessions] = await Promise.all([
		getServerSession(),
		auth.api.listSessions({
			headers: requestHeaders,
		}),
	]).catch(() => {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/profile/account")));
	});

	if (!session?.user) {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/profile/account")));
	}

	const activeSubscription = await getActiveSubscription({ userId: session.user.id });

	// Parse user-agents here (server-side) so `ua-parser-js` stays out of the
	// client bundle; the card just renders the precomputed device info.
	const activeSessionsWithDevice = structuredClone(activeSessions).map((activeSession) => ({
		...activeSession,
		...getSessionDeviceInfo(activeSession.userAgent),
	}));

	return (
		<AccountSettingsPage
			activeSessions={activeSessionsWithDevice}
			session={structuredClone(session)}
			subscription={activeSubscription ? structuredClone(activeSubscription) : undefined}
			subscriptionsEnabled={subscriptionsEnabled}
			user={structuredClone(session.user)}
		/>
	);
}
