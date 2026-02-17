import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
import UserSettings from "./_components/user-settings";

export default async function DashboardPage({
	searchParams,
}: {
	searchParams?: { tab?: string };
}) {
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

	const defaultTab =
		searchParams?.tab === "login" ||
		searchParams?.tab === "subscription" ||
		searchParams?.tab === "snippets"
			? searchParams.tab
			: "profile";

	return (
		<UserSettings
			activeSessions={JSON.parse(JSON.stringify(activeSessions))}
			defaultTab={defaultTab}
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
