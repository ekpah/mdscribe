import type { FinishReason } from "ai";

export const isSuccessfulChatFinish = (input: {
	finishReason?: FinishReason;
	isAbort: boolean;
	isError: boolean;
}) =>
	!input.isAbort &&
	!input.isError &&
	input.finishReason !== "error" &&
	input.finishReason !== "content-filter";

export const isSuccessfulAiscribeFinish = isSuccessfulChatFinish;

export const hasLessThanTenPercentUsageRemaining = (
	monthlyUsagePercentage: number,
) => monthlyUsagePercentage > 90;
