import type { PlaygroundResult } from "@/app/admin/playground/_lib/types";

interface ResolveStreamingPlaygroundResultOptions {
	completion: string;
	isRunning: boolean;
	reasoning: string;
	result: PlaygroundResult | null;
}

export const resolveStreamingPlaygroundResult = ({
	completion,
	isRunning,
	reasoning,
	result,
}: ResolveStreamingPlaygroundResultOptions): PlaygroundResult | null => {
	if (!result || !isRunning) {
		return result;
	}

	return {
		...result,
		isStreaming: true,
		reasoning: reasoning || undefined,
		text: completion,
	};
};
