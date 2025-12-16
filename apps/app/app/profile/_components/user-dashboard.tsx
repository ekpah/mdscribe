"use client";

import type { Subscription } from "@better-auth/stripe";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";
import { FeaturesCard } from "./features-card";
import { ProfileCard } from "./profile-card";
import { SnippetsCard } from "./snippets-card";
import { SubscriptionCard } from "./subscription-card";
import UserCard from "./user-card";

type User = {
	name: string;
	email: string;
};

export default function UserDashboard({
	user,
	subscription,
	generationLimit,
	activeSessions,
	session,
}: {
	user: User;
	subscription?: Subscription;
	generationLimit: number;
	activeSessions: Session["session"][];
	session: Session;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);
	const hasActiveSubscription = !!subscription;

	function handleSubscriptionUpgrade() {
		setIsManagingSubscription(true);
		toast.promise(
			() => authClient.subscription.upgrade({
				plan: "plus",
				successUrl: "/dashboard",
				cancelUrl: "/dashboard",
			}),
			{
				loading: "Dein Abonnement wird aktualisiert...",
				success: "Abonnement erfolgreich aktualisiert!",
				error: "Dein Abonnement konnte nicht aktualisiert werden.",
				finally: () => setIsManagingSubscription(false),
			},
		);
	}

	function handleSubscriptionCancel() {
		setIsManagingSubscription(true);
		toast.promise(
			() => authClient.subscription.cancel({
				returnUrl: "/dashboard",
			}),
			{
				loading: "Dein Abonnement wird storniert...",
				success: "Abonnement erfolgreich storniert!",
				error: "Dein Abonnement konnte nicht storniert werden.",
				finally: () => setIsManagingSubscription(false),
			},
		);
	}

	return (
		<div className="overflow-y-auto">
			<div className="hidden 2xl:block">
				<ProfileCard
					isLoading={isLoading}
					setIsLoading={setIsLoading}
					user={user}
				/>
				<div className="mt-6 grid gap-6 md:grid-cols-2">
					<UserCard
						activeSessions={JSON.parse(JSON.stringify(activeSessions))}
						session={JSON.parse(JSON.stringify(session))}
						subscription={subscription}
					/>
					<SubscriptionCard
						isManagingSubscription={isManagingSubscription}
						onCancel={handleSubscriptionCancel}
						onUpgrade={handleSubscriptionUpgrade}
						subscription={subscription}
					/>
				</div>
				<div className="mt-6">
					<SnippetsCard />
				</div>
			</div>

			<div className="2xl:hidden">
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
							<ProfileCard
								isLoading={isLoading}
								setIsLoading={setIsLoading}
								user={user}
							/>
						</TabsContent>
						<TabsContent className="h-full" value="login">
							<UserCard
								activeSessions={JSON.parse(JSON.stringify(activeSessions))}
								session={JSON.parse(JSON.stringify(session))}
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
