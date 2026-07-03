import { eq, usageEvent, usageObservation } from "@repo/database";
import type { Database } from "@repo/database";
import { after } from "next/server";

import { AI_SCRIBE_GENERATION_EVENT_NAME } from "@/lib/usage-event-names";
import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type {
	StandardUsage,
	UsageInputData,
	UsageMetadata,
	UsageTiming,
} from "@/lib/usage-logging";
import type { ModelConfig } from "@/orpc/scribe/types";

export const redactIfZdrEnabled = (zdrEnabled: boolean, value?: string): string =>
	zdrEnabled ? "[zdr - content redacted]" : (value ?? "");

interface ScribeStreamFinishEvent {
	providerMetadata?: unknown;
	reasoningText?: string;
	text: string;
	usage: unknown;
}

export const scheduleDeferredTask = (task: () => Promise<void>): void => {
	const run = async () => {
		try {
			await task();
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

const buildLoggedModelConfig = (
	modelConfig: ModelConfig,
	reasoningEffort: string | undefined,
): UsageMetadata["modelConfig"] | undefined => {
	const loggedConfig: NonNullable<UsageMetadata["modelConfig"]> = {};
	if (modelConfig.maxTokens !== undefined) {
		loggedConfig.maxTokens = modelConfig.maxTokens;
	}
	if (reasoningEffort !== undefined) {
		loggedConfig.reasoningEffort = reasoningEffort;
	}
	if (modelConfig.temperature !== undefined) {
		loggedConfig.temperature = modelConfig.temperature;
	}

	return Object.keys(loggedConfig).length > 0 ? loggedConfig : undefined;
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
	name?: string;
	promptLabel?: string;
	promptName: string;
	reasoningEffort?: string;
	timing?: UsageTiming;
	observationId?: string;
	traceId?: string;
	usageMetadata?: Partial<UsageMetadata>;
	userId: string;
}): void => {
	const usageEventId = crypto.randomUUID();
	scheduleDeferredTask(
		async () => {
			const openRouterUsage = input.isOpenRouter
				? extractOpenRouterUsage(
						input.event.providerMetadata as Record<string, unknown> | undefined,
					)
				: undefined;

			await input.db.insert(usageEvent).values(
				buildUsageEventData({
					id: usageEventId,
					inputData: input.activeSubscription ? undefined : (input.inputData as UsageInputData),
					metadata: {
						endpoint: input.endpoint,
						modelConfig: buildLoggedModelConfig(input.modelConfig, input.reasoningEffort),
						promptLabel: input.promptLabel,
						promptName: input.promptName,
						...input.usageMetadata,
						zdrEnabled: input.activeSubscription,
					} as UsageMetadata,
					model: input.modelName,
					name: input.name ?? AI_SCRIBE_GENERATION_EVENT_NAME,
					openRouterUsage,
					reasoning: redactIfZdrEnabled(input.activeSubscription, input.event.reasoningText),
					result: redactIfZdrEnabled(input.activeSubscription, input.event.text),
					standardUsage: input.event.usage as StandardUsage,
					timing: input.timing,
					traceId: input.traceId,
					userId: input.userId,
				}),
			);
			if (input.observationId) {
				await input.db
					.update(usageObservation)
					.set({
						endedAt: new Date(),
						status: "succeeded",
						usageEventId,
					})
					.where(eq(usageObservation.id, input.observationId));
			}
		},
	);
};
