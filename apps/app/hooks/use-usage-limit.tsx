"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { authClient } from "@/lib/auth-client";

// Error message that the API returns when usage limit is reached
const USAGE_LIMIT_ERROR_MESSAGE = "Monatliche Nutzungsgrenze erreicht";

/**
 * Check if an error is a usage limit error
 */
export function isUsageLimitError(error: Error | string | unknown): boolean {
	if (typeof error === "string") {
		return error.includes(USAGE_LIMIT_ERROR_MESSAGE);
	}
	if (error instanceof Error) {
		return error.message.includes(USAGE_LIMIT_ERROR_MESSAGE);
	}
	return false;
}

/**
 * Shows an upselling toast when the user has run out of AI credits
 */
export function showUsageLimitToast() {
	toast.custom(
		(t) => (
			<div
				className={`${
					t.visible ? "animate-enter" : "animate-leave"
				} pointer-events-auto flex w-full max-w-md flex-col rounded-lg bg-background shadow-lg ring-1 ring-border`}
			>
				<div className="flex items-start gap-4 p-4">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-solarized-orange/10">
						<TrendingUp className="size-5 text-solarized-orange" />
					</div>
					<div className="flex-1 space-y-1">
						<p className="font-semibold text-foreground text-sm">
							Monatliche KI-Nutzung erreicht
						</p>
						<p className="text-muted-foreground text-sm">
							Du hast dein monatliches Kontingent aufgebraucht. Upgrade auf Plus
							für 10x mehr Generierungen!
						</p>
					</div>
				</div>
				<div className="flex gap-2 border-t border-border p-3">
					<Button
						className="flex-1 gap-2"
						onClick={() => {
							toast.dismiss(t.id);
							// Trigger subscription upgrade
							authClient.subscription.upgrade({
								plan: "plus",
								successUrl: "/dashboard",
								cancelUrl: "/dashboard",
							});
						}}
						size="sm"
						type="button"
					>
						<Sparkles className="size-4" />
						Jetzt upgraden
					</Button>
					<Button
						onClick={() => toast.dismiss(t.id)}
						size="sm"
						type="button"
						variant="outline"
					>
						Später
					</Button>
				</div>
			</div>
		),
		{
			duration: 10000, // Show for 10 seconds
			position: "top-center",
		},
	);
}

/**
 * Hook for handling usage limit state and actions
 */
export function useUsageLimit() {
	const [hasReachedLimit, setHasReachedLimit] = useState(false);

	const handleError = useCallback((error: Error | string | unknown) => {
		if (isUsageLimitError(error)) {
			setHasReachedLimit(true);
			showUsageLimitToast();
			return true;
		}
		return false;
	}, []);

	const handleUpgrade = useCallback(() => {
		authClient.subscription.upgrade({
			plan: "plus",
			successUrl: "/dashboard",
			cancelUrl: "/dashboard",
		});
	}, []);

	const resetLimit = useCallback(() => {
		setHasReachedLimit(false);
	}, []);

	return {
		hasReachedLimit,
		handleError,
		handleUpgrade,
		resetLimit,
	};
}
