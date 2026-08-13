"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let isHighlighted = false;

const emit = (nextValue: boolean) => {
	if (nextValue === isHighlighted) {
		return;
	}
	isHighlighted = nextValue;
	for (const listener of listeners) {
		listener();
	}
};

const updateModifier = (event: KeyboardEvent) => emit(event.metaKey || event.ctrlKey);
const clearModifier = () => emit(false);
const clearHiddenModifier = () => {
	if (document.visibilityState === "hidden") {
		clearModifier();
	}
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	if (listeners.size === 1) {
		window.addEventListener("keydown", updateModifier);
		window.addEventListener("keyup", updateModifier);
		window.addEventListener("blur", clearModifier);
		document.addEventListener("visibilitychange", clearHiddenModifier);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("keydown", updateModifier);
			window.removeEventListener("keyup", updateModifier);
			window.removeEventListener("blur", clearModifier);
			document.removeEventListener("visibilitychange", clearHiddenModifier);
			isHighlighted = false;
		}
	};
};

const getSnapshot = () => isHighlighted;
const getServerSnapshot = () => false;

/** Shares one modifier-key listener set across every rendered Markdoc block. */
export const useCitationModifier = (): boolean =>
	useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
