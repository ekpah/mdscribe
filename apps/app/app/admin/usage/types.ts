interface UsageEventUser {
	email: string;
	id: string;
	name: string | null;
}

export interface UsageListEvent {
	children?: UsageListEvent[];
	cost: number | string | null;
	id: string;
	inputTokens: number | null;
	metadata: unknown;
	model: string | null;
	name: string;
	outputTokens: number | null;
	reasoningTokens: number | null;
	timestamp: Date | string;
	timeToCompletionMs: number | null;
	timeToFirstTokenMs: number | null;
	totalTokens: number | null;
	traceId?: string | null;
	user: UsageEventUser | null;
	linkedUsageEventId?: string;
	observationId?: string;
	rowKind?: "event" | "observation" | "tool" | "trace";
	toolInputData?: unknown;
	toolOutputData?: unknown;
}

export interface UsageDetailEvent extends UsageListEvent {
	cachedTokens: number | null;
	inputData: unknown;
	inputTokens: number | null;
	reasoning: string | null;
	reasoningTokens: number | null;
	result: string | null;
}

export interface UsageEvaluation {
	categories: {
		comment?: string;
		name: string;
		score: number;
	}[];
	evaluatedAt: string;
	summary: string;
	totalScore: number;
}

export type StatsFilter = "today" | "week" | "month" | "all";

export type UsageTrendMetric =
	| "cost"
	| "events"
	| "timeToCompletionMs"
	| "timeToFirstTokenMs"
	| "tokens"
	| "tokensPerSecond";
