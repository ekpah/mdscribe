import { usageEvent } from "@repo/database";
import type { Database } from "@repo/database";
import { after } from "next/server";

import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage, UsageInputData, UsageMetadata } from "@/lib/usage-logging";
import type { ModelConfig } from "@/orpc/scribe/types";

export const redactIfZdrEnabled = (
	zdrEnabled: boolean,
	value: string | undefined,
): string => (zdrEnabled ? "[zdr - content redacted]" : (value ?? ""));

interface ScribeStreamFinishEvent {
	providerMetadata?: unknown;
	reasoningText?: string;
	text: string;
	usage: unknown;
}

const scheduleDeferredTask = (task: Promise<void>): void => {
	const run = async () => {
		try {
			await task;
		} catch (error) {
			console.error("Deferred usage logging failed:", error);
		}
	};

	try {
		after(run);
	} catch {
		run();
	}
};

export const scheduleScribeUsageLogging = (input: {
	activeSubscription: boolean;
	db: Database;
	endpoint: string;
	event: ScribeStreamFinishEvent;
	inputData: Record<string, unknown>;
	isOpenRouter: boolean;
	modelConfig: ModelConfig;
	modelName: string;
	promptName: string;
	thinkingEnabled: boolean;
	userId: string;
}): void => {
	scheduleDeferredTask((async () => {
		const openRouterUsage = input.isOpenRouter
			? extractOpenRouterUsage(input.event.providerMetadata)
			: undefined;

		await input.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: input.activeSubscription
					? undefined
					: (input.inputData as UsageInputData),
				metadata: {
					endpoint: input.endpoint,
					modelConfig: {
						maxTokens: input.modelConfig.maxTokens,
						temperature: input.modelConfig.temperature,
					},
					promptName: input.promptName,
					promptSource: "local",
					streamingMode: true,
					thinkingBudget: input.thinkingEnabled
						? input.modelConfig.thinkingBudget
						: undefined,
					thinkingEnabled: input.thinkingEnabled,
					zdrEnabled: input.activeSubscription,
				} as UsageMetadata,
				model: input.modelName,
				name: "ai_scribe_generation",
				openRouterUsage,
				reasoning: redactIfZdrEnabled(
					input.activeSubscription,
					input.event.reasoningText,
				),
				result: redactIfZdrEnabled(input.activeSubscription, input.event.text),
				standardUsage: input.event.usage as StandardUsage,
				userId: input.userId,
			}),
		);
	})());
};
