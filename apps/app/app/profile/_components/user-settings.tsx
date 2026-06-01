"use client";

import type { Subscription } from "@better-auth/stripe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";

import { ProfileCard } from "./profile-card";
import { SnippetsCard } from "./snippets-card";
import { SubscriptionCard } from "./subscription-card";
import UserCard from "./user-card";

interface User {
	email: string;
	name: string | null;
}

export default function UserSettings({
	user,
	subscription,
	activeSessions,
	session,
}: {
	user: User;
	subscription?: Subscription;
	activeSessions: Session["session"][];
	session: Session;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	const handleSubscriptionUpgrade = useCallback(() => {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.upgrade({
					cancelUrl: "/dashboard",
					plan: "plus",
					successUrl: "/dashboard",
				}),
			{
				error: "Dein Abonnement konnte nicht aktualisiert werden.",
				finally: () => setIsManagingSubscription(false),
				loading: "Dein Abonnement wird aktualisiert...",
				success: "Abonnement erfolgreich aktualisiert!",
			},
		);
	}, []);

	const handleSubscriptionCancel = useCallback(() => {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.cancel({
					returnUrl: "/dashboard",
				}),
			{
				error: "Dein Abonnement konnte nicht storniert werden.",
				finally: () => setIsManagingSubscription(false),
				loading: "Dein Abonnement wird storniert...",
				success: "Abonnement erfolgreich storniert!",
			},
		);
	}, []);

	return (
		<div className="overflow-y-auto">
			<div>
				<Tabs className="w-full p-4" defaultValue="profile">
					<TabsList className="w-full">
						<TabsTrigger className="w-full" value="profile">
							Profil
						</TabsTrigger>
						<TabsTrigger className="w-full" value="login">
							Account
						</TabsTrigger>
						<TabsTrigger className="w-full" value="subscription">
							Abonnement
						</TabsTrigger>
						<TabsTrigger className="w-full" value="snippets">
							Snippets
						</TabsTrigger>
					</TabsList>
					<div className="h-[500px] w-[800px] max-w-full">
						<TabsContent className="h-full" value="profile">
							<ProfileCard isLoading={isLoading} setIsLoading={setIsLoading} user={user} />
						</TabsContent>
						<TabsContent className="h-full" value="login">
							<UserCard
								activeSessions={structuredClone(activeSessions)}
								session={structuredClone(session)}
								subscription={subscription}
							/>
						</TabsContent>
						<TabsContent className="h-full" value="subscription">
							<SubscriptionCard
								isManagingSubscription={isManagingSubscription}
								onCancel={handleSubscriptionCancel}
								onUpgrade={handleSubscriptionUpgrade}
								subscription={subscription}
							/>
						</TabsContent>
						<TabsContent className="h-full" value="snippets">
							<SnippetsCard />
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
}
