import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerSession } from "@/lib/server-session";
import { SubscriptionManagementCard } from "./_components/subscription-management-card";

export default async function SubscriptionPage() {
	const requestHeaders = await headers();
	const [session, subscriptions] = await Promise.all([
		getServerSession(),
		auth.api.listActiveSubscriptions({ headers: requestHeaders }),
	]).catch((_e) => {
		throw redirect("/sign-in");
	});

	if (!session?.user) {
		redirect("/sign-in");
	}

	const activeSubscription = subscriptions.find(
		(sub) => sub.status === "active" || sub.status === "trialing",
	);

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-solarized-base3 via-solarized-base2 to-solarized-base2">
			<div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
				<Link href="/dashboard">
					<Button className="gap-2 bg-transparent" size="sm" variant="outline">
						<ArrowLeft className="h-4 w-4" />
						Zurück zum Dashboard
					</Button>
				</Link>

				<div className="space-y-2">
					<h1 className="font-bold text-3xl text-solarized-base03">
						Abonnement
					</h1>
					<p className="text-solarized-base01">
						Verwalten Sie Ihren Tarif und Ihre Zahlungsinformationen.
					</p>
				</div>

				<SubscriptionManagementCard
					subscription={
						activeSubscription
							? JSON.parse(JSON.stringify(activeSubscription))
							: undefined
					}
				/>
			</div>
		</div>
	);
}
