"use client";

import { useProductTour } from "@/hooks/use-product-tour";
import { dashboardTourSteps } from "./tour-steps";
import { toast } from "sonner";

/**
 * ProductTour component for the dashboard
 *
 * This component:
 * - Auto-starts the tour on first visit
 * - Shows a toast when tour completes
 * - Renders nothing visible (tour is overlay-based)
 */
export function ProductTour() {
	useProductTour({
		steps: dashboardTourSteps,
		autoStart: true,
		onComplete: () => {
			toast.success("Tour abgeschlossen!", {
				description: "Sie können die Tour jederzeit im Profil erneut starten.",
			});
		},
		onSkip: () => {
			// Silently mark as completed when skipped
			// User chose to skip, don't bother them again
		},
		config: {
			nextBtnText: "Weiter",
			prevBtnText: "Zurück",
			doneBtnText: "Fertig",
			progressText: "{{current}} von {{total}}",
		},
	});

	// This component doesn't render anything
	// The tour is managed via driver.js overlay
	return null;
}
