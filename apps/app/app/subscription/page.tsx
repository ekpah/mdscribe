import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";
import { subscriptionsEnabled } from "@/lib/stripe-config";
import { getActiveSubscription } from "@/lib/subscriptions";

import { SubscriptionManagementCard } from "./_components/subscription-management-card";

export default async function SubscriptionPage() {
	if (!subscriptionsEnabled) {
		redirect("/dashboard");
	}

	const requestHeaders = await headers();
	const session = await getServerSession().catch((_e) => {
		throw redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/subscription")));
	});

	if (!session?.user) {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/subscription")));
	}

	const activeSubscription = await getActiveSubscription({ userId: session.user.id });

	return (
		<div className="h-full w-screen overflow-y-auto bg-gradient-to-br from-solarized-base3 via-solarized-base2 to-solarized-base2">
			<div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-16 sm:p-6">
				<Link href="/dashboard">
					<Button className="gap-2 bg-transparent" size="sm" variant="outline">
						<ArrowLeft className="h-4 w-4" />
						Zurück zum Dashboard
					</Button>
				</Link>

				<div className="space-y-2">
					<h1 className="font-bold text-3xl text-solarized-base03">Abonnement</h1>
					<p className="text-solarized-base01">
						Verwalten Sie Ihren Tarif und Ihre Zahlungsinformationen.
					</p>
				</div>

				<SubscriptionManagementCard
					subscription={activeSubscription ? structuredClone(activeSubscription) : undefined}
				/>
			</div>
		</div>
	);
}
