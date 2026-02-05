"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_STORAGE_KEY = "mdscribe-tour-completed";
const TOUR_VERSION = "1"; // Increment to show tour again after major updates

export interface UseProductTourOptions {
	steps: DriveStep[];
	/** Whether the tour should auto-start on first visit */
	autoStart?: boolean;
	/** Callback when tour completes */
	onComplete?: () => void;
	/** Callback when tour is skipped/dismissed */
	onSkip?: () => void;
	/** Additional driver.js config options */
	config?: Partial<Config>;
}

export interface UseProductTourReturn {
	/** Start the tour manually */
	start: () => void;
	/** Stop/destroy the tour */
	stop: () => void;
	/** Whether the tour is currently active */
	isActive: boolean;
	/** Whether this is the user's first visit (tour not completed) */
	isFirstVisit: boolean;
	/** Reset the tour state (will show tour again) */
	reset: () => void;
}

/**
 * Hook for managing product tours with driver.js
 *
 * Features:
 * - Auto-starts on first visit (can be disabled)
 * - Persists completion state in localStorage
 * - Supports versioned tours (bump version to re-show)
 * - Handles SSR gracefully
 */
export function useProductTour({
	steps,
	autoStart = true,
	onComplete,
	onSkip,
	config,
}: UseProductTourOptions): UseProductTourReturn {
	const driverRef = useRef<ReturnType<typeof driver> | null>(null);
	const [isActive, setIsActive] = useState(false);
	const [isFirstVisit, setIsFirstVisit] = useState(false);
	const hasAutoStarted = useRef(false);

	// Check if tour was completed (client-side only)
	useEffect(() => {
		if (typeof window === "undefined") return;

		const completedVersion = localStorage.getItem(TOUR_STORAGE_KEY);
		const firstVisit = completedVersion !== TOUR_VERSION;
		setIsFirstVisit(firstVisit);
	}, []);

	// Mark tour as completed
	const markCompleted = useCallback(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(TOUR_STORAGE_KEY, TOUR_VERSION);
		setIsFirstVisit(false);
	}, []);

	// Start the tour
	const start = useCallback(() => {
		if (driverRef.current) {
			driverRef.current.destroy();
		}

		driverRef.current = driver({
			showProgress: true,
			animate: true,
			allowClose: true,
			overlayColor: "rgba(0, 0, 0, 0.75)",
			stagePadding: 8,
			stageRadius: 8,
			popoverClass: "mdscribe-tour-popover",
			...config,
			steps,
			onDestroyStarted: () => {
				// User clicked X or outside - consider it skipped
				if (driverRef.current?.hasNextStep()) {
					onSkip?.();
				}
				driverRef.current?.destroy();
				setIsActive(false);
			},
			onDestroyed: () => {
				setIsActive(false);
			},
			onNextClick: () => {
				// Check if this is the last step
				if (!driverRef.current?.hasNextStep()) {
					markCompleted();
					onComplete?.();
					driverRef.current?.destroy();
				} else {
					driverRef.current?.moveNext();
				}
			},
		});

		driverRef.current.drive();
		setIsActive(true);
	}, [steps, config, onComplete, onSkip, markCompleted]);

	// Stop the tour
	const stop = useCallback(() => {
		driverRef.current?.destroy();
		setIsActive(false);
	}, []);

	// Reset tour state
	const reset = useCallback(() => {
		if (typeof window === "undefined") return;
		localStorage.removeItem(TOUR_STORAGE_KEY);
		setIsFirstVisit(true);
	}, []);

	// Auto-start on first visit
	useEffect(() => {
		if (
			autoStart &&
			isFirstVisit &&
			!hasAutoStarted.current &&
			steps.length > 0
		) {
			// Small delay to ensure DOM elements are rendered
			const timer = setTimeout(() => {
				hasAutoStarted.current = true;
				start();
			}, 500);

			return () => clearTimeout(timer);
		}
	}, [autoStart, isFirstVisit, start, steps.length]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			driverRef.current?.destroy();
		};
	}, []);

	return {
		start,
		stop,
		isActive,
		isFirstVisit,
		reset,
	};
}
