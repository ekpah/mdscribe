export const getAudioMediaType = (
	mimeType: string | undefined,
	isOpenRouter: boolean,
): string => {
	if (isOpenRouter) {
		// Keep legacy compatibility for currently working OpenRouter audio flows.
		return "audio/wav";
	}

	return mimeType || "audio/webm";
};
