"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { useCallback, useRef, useState } from "react";
import type {
	AudioFile,
	DocumentType,
	SupportedModel,
} from "@/orpc/scribe/types";
import type { router } from "@/orpc/router";
import type { RouterClient } from "@orpc/server";

// Create a dedicated client for streaming
const link = new RPCLink({
	url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/rpc`,
	headers: async () => ({}),
});

const client: RouterClient<typeof router> = createORPCClient(link);

interface UseScribeStreamOptions {
	documentType: DocumentType;
	onError?: (error: Error) => void;
	onFinish?: (completion: string) => void;
}

interface UseScribeStreamReturn {
	completion: string;
	isLoading: boolean;
	error: Error | null;
	complete: (
		prompt: string,
		options?: { body?: { model?: SupportedModel; audioFiles?: AudioFile[] } },
	) => Promise<void>;
	setCompletion: (completion: string) => void;
	stop: () => void;
}

/**
 * Hook for streaming document generation using oRPC
 *
 * This hook provides a similar interface to useCompletion from @ai-sdk/react
 * but uses oRPC for type-safe streaming.
 *
 * @example
 * const { completion, isLoading, complete } = useScribeStream({
 *   documentType: 'discharge',
 *   onFinish: (text) => toast.success('Generated!'),
 * });
 *
 * await complete(JSON.stringify({ anamnese: '...', ... }), {
 *   body: { model: 'claude-opus-4.5' }
 * });
 */
export function useScribeStream({
	documentType,
	onError,
	onFinish,
}: UseScribeStreamOptions): UseScribeStreamReturn {
	const [completion, setCompletion] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const stop = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
			setIsLoading(false);
		}
	}, []);

	const complete = useCallback(
		async (
			prompt: string,
			options?: { body?: { model?: SupportedModel; audioFiles?: AudioFile[] } },
		) => {
			setIsLoading(true);
			setError(null);
			setCompletion("");

			const controller = new AbortController();
			abortControllerRef.current = controller;

			const model = options?.body?.model ?? "auto";
			const audioFiles = options?.body?.audioFiles;

			try {
				// Call the oRPC streaming endpoint
				const eventIterator = await client.scribeStream(
					{
						documentType,
						prompt,
						model,
						audioFiles,
					},
					{ signal: controller.signal },
				);

				let fullText = "";

				// Process the event iterator
				for await (const event of eventIterator) {
					if (controller.signal.aborted) break;

					// The AI SDK UIMessage stream events have different types
					// We're looking for text content
					if (event && typeof event === "object") {
						const eventData = event as Record<string, unknown>;

						// Handle text-delta events from the UI message stream
						if (eventData.type === "text-delta" && eventData.textDelta) {
							fullText += eventData.textDelta as string;
							setCompletion(fullText);
						}

						// Handle content updates
						if (eventData.type === "content" && eventData.content) {
							const content = eventData.content as Array<{
								type: string;
								text?: string;
							}>;
							for (const part of content) {
								if (part.type === "text" && part.text) {
									fullText = part.text;
									setCompletion(fullText);
								}
							}
						}
					}
				}

				setIsLoading(false);
				onFinish?.(fullText);
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					setIsLoading(false);
					return;
				}

				const error = err instanceof Error ? err : new Error("Unknown error");
				setError(error);
				setIsLoading(false);
				onError?.(error);
			}
		},
		[documentType, onError, onFinish],
	);

	return {
		completion,
		isLoading,
		error,
		complete,
		setCompletion,
		stop,
	};
}
