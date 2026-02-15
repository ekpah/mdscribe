// PERF: Server Component - fetch session once on server, pass to children
import { getServerSession } from "@/lib/server-session";
import LandingPage from "./_components/landing/LandingPage";

export default async function Page() {
	// Fetch session on server - eliminates 4 redundant client-side auth checks
	const session = await getServerSession();

	const isLoggedIn = !!session?.user;

	return <LandingPage isLoggedIn={isLoggedIn} />;
}
