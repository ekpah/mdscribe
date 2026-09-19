import { getServerSession } from "@/lib/server-session";
import { subscriptionsEnabled } from "@/lib/stripe-config";

import { LandingPage } from "./_components/landing/landing-page";

export default async function Page() {
	const session = await getServerSession();

	return (
		<LandingPage isLoggedIn={Boolean(session?.user)} subscriptionsEnabled={subscriptionsEnabled} />
	);
}
