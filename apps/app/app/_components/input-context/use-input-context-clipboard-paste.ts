"use client";

import type { ClipboardEvent } from "react";
import { useCallback } from "react";

import { getClipboardFiles, splitClipboardInputFiles } from "./clipboard";
import type { InputContextController } from "./types";

interface UseInputContextClipboardPasteOptions {
	controller: InputContextController;
	disabled?: boolean;
	onAudioFilesAdded?: () => void;
	onContextFilesAdded?: () => void;
}

/**
 * Preserves normal text pasting. When the clipboard contains files, adds audio
 * to the audio context and all other files to the file context instead.
 */
export const useInputContextClipboardPaste = ({
	controller,
	disabled = false,
	onAudioFilesAdded,
	onContextFilesAdded,
}: UseInputContextClipboardPasteOptions) =>
	useCallback(
		(event: ClipboardEvent<HTMLElement>) => {
			if (disabled || event.defaultPrevented) {
				return;
			}

			const files = getClipboardFiles(event.clipboardData);
			if (files.length === 0) {
				return;
			}

			event.preventDefault();
			const { audioFiles, contextFiles } = splitClipboardInputFiles(files);
			if (audioFiles.length > 0 && controller.addAudioFiles(audioFiles)) {
				onAudioFilesAdded?.();
			}
			if (contextFiles.length > 0 && controller.addContextFiles(contextFiles)) {
				onContextFilesAdded?.();
			}
		},
		[controller, disabled, onAudioFilesAdded, onContextFilesAdded],
	);
