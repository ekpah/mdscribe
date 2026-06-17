"use client";

import type { Subscription } from "@better-auth/stripe";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";

import { ProfileCard } from "./profile-card";
import { SubscriptionCard } from "./subscription-card";
import UserCard from "./user-card";

interface User {
	readonly email: string;
	readonly name: string | null;
	readonly username?: string | null;
}

interface AccountSettingsPageProps {
	readonly user: User;
	readonly subscription?: Subscription;
	readonly activeSessions: Session["session"][];
	readonly session: Session;
}

export const AccountSettingsPage = ({
	user,
	subscription,
	activeSessions,
	session,
}: AccountSettingsPageProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	const handleSubscriptionUpgrade = useCallback(() => {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.upgrade({
					cancelUrl: "/profile/account",
					plan: "plus",
					successUrl: "/profile/account",
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
					returnUrl: "/profile/account",
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
		<div className="space-y-6">
			<div className="space-y-1">
				<h2 className="font-semibold text-solarized-base00 text-2xl">Account</h2>
				<p className="text-sm text-solarized-base01">
					Profil, aktive Sitzungen und Abonnement.
				</p>
			</div>
			<div className="space-y-6">
				<ProfileCard isLoading={isLoading} setIsLoading={setIsLoading} user={user} />
				<UserCard
					activeSessions={activeSessions}
					session={session}
					subscription={subscription}
				/>
				<SubscriptionCard
					isManagingSubscription={isManagingSubscription}
					onCancel={handleSubscriptionCancel}
					onUpgrade={handleSubscriptionUpgrade}
					subscription={subscription}
				/>
			</div>
		</div>
	);
};
