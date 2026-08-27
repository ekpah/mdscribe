import { usageEvent } from "@repo/database";
import type { Database } from "@repo/database";

import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type {
	StandardUsage,
	UsageInputData,
	UsageMetadata,
	UsageTiming,
} from "@/lib/usage-logging";

import { scheduleDeferredTask } from "./usage-logging";

interface LogMediaPreprocessingUsageInput {
	db?: Database;
	inputData?: UsageInputData;
	isOpenRouter: boolean;
	metadata: UsageMetadata;
	modelName: string;
	name: string;
	providerMetadata?: Record<string, unknown>;
	result?: string;
	standardUsage?: StandardUsage;
	timing?: UsageTiming;
	userId?: string;
	zdr?: boolean;
}

const redactIfNeeded = (
	zdr: boolean | undefined,
	value: string | undefined,
): string | undefined => {
	if (value === undefined) {
		return undefined;
	}
	return zdr ? "[zdr - content redacted]" : value;
};

export const logMediaPreprocessingUsage = ({
	db,
	inputData,
	isOpenRouter,
	metadata,
	modelName,
	name,
	providerMetadata,
	result,
	standardUsage,
	timing,
	userId,
	zdr,
}: LogMediaPreprocessingUsageInput): void => {
	if (!(db && userId)) {
		return;
	}

	scheduleDeferredTask(async () => {
		await db.insert(usageEvent).values(
			buildUsageEventData({
				inputData,
				metadata: {
					...metadata,
					zdrEnabled: Boolean(zdr),
				},
				model: modelName,
				name,
				openRouterUsage: isOpenRouter ? extractOpenRouterUsage(providerMetadata) : undefined,
				result: redactIfNeeded(zdr, result),
				standardUsage,
				timing,
				userId,
			}),
		);
	});
};
