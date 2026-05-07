interface UsageEventUser {
	email: string;
	id: string;
	name: string | null;
}

export interface UsageListEvent {
	cost: number | string | null;
	id: string;
	metadata: unknown;
	model: string | null;
	name: string;
	outputTokens: number | null;
	timestamp: Date | string;
	timeToCompletionMs: number | null;
	timeToFirstTokenMs: number | null;
	totalTokens: number | null;
	user: UsageEventUser | null;
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
