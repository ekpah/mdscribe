"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { HelpCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TOUR_STORAGE_KEY = "mdscribe-tour-completed";

export function TourCard() {
	const router = useRouter();

	function handleRestartTour() {
		// Clear the tour completion flag
		localStorage.removeItem(TOUR_STORAGE_KEY);

		toast.success("Tour wird neu gestartet...", {
			description: "Sie werden zum Dashboard weitergeleitet.",
		});

		// Navigate to dashboard where tour will auto-start
		setTimeout(() => {
			router.push("/dashboard");
		}, 500);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<HelpCircle className="h-5 w-5" />
					Produkt-Tour
				</CardTitle>
				<CardDescription>
					Sehen Sie sich die Einführungstour erneut an, um die wichtigsten
					Funktionen von MDScribe kennenzulernen.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					className="gap-2"
					onClick={handleRestartTour}
					variant="outline"
				>
					<RotateCcw className="h-4 w-4" />
					Tour neu starten
				</Button>
			</CardContent>
		</Card>
	);
}
