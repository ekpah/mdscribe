import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";
import UserSettings from "./_components/user-settings";

export default async function DashboardPage() {
	// Get the mocked session
	const requestHeaders = await headers();
	const [session, activeSessions, subscriptions] = await Promise.all([
		getServerSession(),
		auth.api.listSessions({
			headers: requestHeaders,
		}),
		auth.api.listActiveSubscriptions({
			headers: requestHeaders,
		}),
	]).catch((_e) => {
		throw redirect(
			createSignInRedirect(getRequestedPath(requestHeaders, "/profile")),
		);
	});
	if (!session?.user) {
		redirect(
			createSignInRedirect(getRequestedPath(requestHeaders, "/profile")),
		);
	}
	const activeSubscription = subscriptions.find(
		(sub) => sub.status === "active" || sub.status === "trialing",
	);

	return (
		<UserSettings
			activeSessions={structuredClone(activeSessions)}
			session={structuredClone(session)}
			subscription={
				activeSubscription
					? structuredClone(activeSubscription)
					: undefined
			}
			user={structuredClone(session.user)}
		/>
	);
}
