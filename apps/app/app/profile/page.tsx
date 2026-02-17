import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
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
		throw redirect("/sign-in");
	});
	if (!session?.user) {
		redirect("/sign-in");
	}
	const activeSubscription = subscriptions.find(
		(sub) => sub.status === "active" || sub.status === "trialing",
	);
	const generationLimit =
		(activeSubscription?.limits?.ai_scribe_generations as number) || 0;

	return (
		<UserSettings
			activeSessions={JSON.parse(JSON.stringify(activeSessions))}
			generationLimit={generationLimit}
			session={JSON.parse(JSON.stringify(session))}
			subscription={
				activeSubscription
					? JSON.parse(JSON.stringify(activeSubscription))
					: undefined
			}
			user={JSON.parse(JSON.stringify(session.user))}
		/>
	);
}
