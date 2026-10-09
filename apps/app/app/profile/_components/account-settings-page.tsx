"use client";

import type { Subscription } from "@better-auth/stripe";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { unwrapAuthClientResult } from "@/lib/auth-client-result";
import type { Session } from "@/lib/auth-types";
import { getBillingClient } from "@/lib/billing-client";
import type { ActiveSessionView } from "@/lib/session-device";

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
	readonly activeSessions: ActiveSessionView[];
	readonly session: Session;
	readonly subscriptionsEnabled: boolean;
}

export const AccountSettingsPage = ({
	user,
	subscription,
	activeSessions,
	session,
	subscriptionsEnabled,
}: AccountSettingsPageProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);

	const handleSubscriptionUpgrade = useCallback(() => {
		setIsManagingSubscription(true);
		toast.promise(
			async () => {
				const billingClient = await getBillingClient();
				return unwrapAuthClientResult(
					await billingClient.subscription.upgrade({
						cancelUrl: "/profile/account",
						plan: "plus",
						successUrl: "/profile/account",
					}),
				);
			},
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
			async () => {
				const billingClient = await getBillingClient();
				return unwrapAuthClientResult(
					await billingClient.subscription.cancel({
						returnUrl: "/profile/account",
					}),
				);
			},
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
					{subscriptionsEnabled
						? "Profil, aktive Sitzungen und Abonnement."
						: "Profil und aktive Sitzungen."}
				</p>
			</div>
			<div className="space-y-6">
				<ProfileCard isLoading={isLoading} setIsLoading={setIsLoading} user={user} />
				<UserCard activeSessions={activeSessions} session={session} />
				{subscriptionsEnabled ? (
					<SubscriptionCard
						isManagingSubscription={isManagingSubscription}
						onCancel={handleSubscriptionCancel}
						onUpgrade={handleSubscriptionUpgrade}
						subscription={subscription}
					/>
				) : null}
			</div>
		</div>
	);
};
