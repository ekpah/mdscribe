import LandingPage from "./_components/landing/landing-page";
import { getServerSession } from "@/lib/server-session";

export default async function Page() {
	const session = await getServerSession();

	return <LandingPage isLoggedIn={Boolean(session?.user)} />;
}
