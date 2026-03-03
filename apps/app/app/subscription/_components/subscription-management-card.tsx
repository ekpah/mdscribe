"use client";

import type { Subscription } from "@better-auth/stripe";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { CreditCard, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

function getPlanLabel(plan?: string | null) {
	if (!plan) {
		return "Basis";
	}

	const normalizedPlan = plan.toLowerCase();
	return normalizedPlan === "plus"
		? "Plus"
		: normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
}

function getStatusBadge(subscription?: Subscription) {
	if (!subscription) {
		return {
			className: "border-solarized-base1 text-solarized-base01",
			label: "Kein Abonnement",
		};
	}

	if (subscription.cancelAtPeriodEnd) {
		return {
			className: "border-solarized-orange text-solarized-orange",
			label: "Wird gekündigt",
		};
	}

	if (subscription.status === "trialing") {
		return {
			className: "border-solarized-blue text-solarized-blue",
			label: "Testphase",
		};
	}

	return {
		className: "border-solarized-green text-solarized-green",
		label: "Aktiv",
	};
}

export function SubscriptionManagementCard({
	subscription,
}: {
	subscription?: Subscription;
}) {
	const [isManagingSubscription, setIsManagingSubscription] = useState(false);
	const hasActiveSubscription = Boolean(subscription);
	const usageLimit = hasActiveSubscription ? 500 : 50;
	const statusBadge = getStatusBadge(subscription);
	const planLabel = getPlanLabel(subscription?.plan);

	function handleUpgrade() {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.upgrade({
					cancelUrl: "/subscription",
					plan: "plus",
					successUrl: "/subscription",
				}),
			{
				error: "Abonnement konnte nicht aktualisiert werden.",
				finally: () => setIsManagingSubscription(false),
				loading: "Abonnement wird aktualisiert...",
				success: "Abonnement erfolgreich aktualisiert.",
			},
		);
	}

	function handleCancel() {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.cancel({
					returnUrl: "/subscription",
				}),
			{
				error: "Abonnement konnte nicht storniert werden.",
				finally: () => setIsManagingSubscription(false),
				loading: "Abonnement wird storniert...",
				success: "Abonnement erfolgreich storniert.",
			},
		);
	}

	function handleBillingPortal() {
		setIsManagingSubscription(true);
		toast.promise(
			() =>
				authClient.subscription.billingPortal({
					returnUrl: "/subscription",
				}),
			{
				error: "Zahlungsportal konnte nicht geöffnet werden.",
				finally: () => setIsManagingSubscription(false),
				loading: "Abonnement wird geöffnet...",
				success: "Weiterleitung zum Zahlungsportal...",
			},
		);
	}

	return (
		<Card className="border-solarized-violet/30 bg-solarized-base3 shadow-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-solarized-base03">
					<CreditCard className="h-5 w-5 text-solarized-violet" />
					Aktueller Tarif
				</CardTitle>
				<CardDescription>
					Sehen Sie Ihren aktuellen Tarifstatus ein und verwalten Sie Ihr
					Abonnement.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between rounded-lg bg-solarized-base2 p-3">
					<span className="font-medium text-solarized-base03 text-sm">
						Tarif
					</span>
					<span className="font-semibold text-solarized-base03 text-sm">
						{planLabel}
					</span>
				</div>
				<div className="flex items-center justify-between rounded-lg bg-solarized-base2 p-3">
					<span className="font-medium text-solarized-base03 text-sm">
						Status
					</span>
					<Badge className={statusBadge.className} variant="outline">
						{statusBadge.label}
					</Badge>
				</div>
				<div className="flex items-center justify-between rounded-lg bg-solarized-base2 p-3">
					<span className="font-medium text-solarized-base03 text-sm">
						Monatliches Kontingent
					</span>
					<span className="font-semibold text-solarized-base03 text-sm">
						{usageLimit} KI-Generierungen
					</span>
				</div>
				{subscription?.periodEnd ? (
					<div className="flex items-center justify-between rounded-lg bg-solarized-base2 p-3">
						<span className="font-medium text-solarized-base03 text-sm">
							{subscription.cancelAtPeriodEnd
								? "Endet am"
								: "Nächste Abrechnung"}
						</span>
						<span className="font-semibold text-solarized-base03 text-sm">
							{new Date(subscription.periodEnd).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "2-digit",
								year: "numeric",
							})}
						</span>
					</div>
				) : null}
			</CardContent>
			<CardFooter className="flex flex-col gap-3 sm:flex-row">
				{hasActiveSubscription ? (
					<>
						<Button
							className="w-full gap-2 sm:w-auto"
							disabled={isManagingSubscription}
							onClick={handleBillingPortal}
							variant="secondary"
						>
							<Sparkles className="h-4 w-4" />
							Tarif & Zahlung verwalten
						</Button>
						{subscription?.cancelAtPeriodEnd ? null : (
							<Button
								className="w-full text-destructive hover:text-destructive sm:w-auto"
								disabled={isManagingSubscription}
								onClick={handleCancel}
								variant="outline"
							>
								Abonnement kündigen
							</Button>
						)}
					</>
				) : (
					<Button
						className="w-full gap-2"
						disabled={isManagingSubscription}
						onClick={handleUpgrade}
					>
						<Sparkles className="h-4 w-4" />
						Jetzt Plus aktivieren
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
