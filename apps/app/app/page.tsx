// PERF: Server Component - fetch session once on server, pass to children
import { auth } from "@/auth";
import { headers } from "next/headers";
import LandingPage from "./_components/landing/LandingPage";

export default async function Page() {
	// Fetch session on server - eliminates 4 redundant client-side auth checks
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isLoggedIn = !!session?.user;

	return <LandingPage isLoggedIn={isLoggedIn} />;
}
