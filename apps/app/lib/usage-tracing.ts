import { desc, eq, usageObservation, usageTrace } from "@repo/database";
import type { Database } from "@repo/database";

type ObservationType = "agent" | "generation" | "tool";

export const startUsageTrace = async ({
	db,
	metadata,
	name,
	userId,
}: {
	db: Database;
	metadata?: Record<string, unknown>;
	name: string;
	userId: string;
}) => {
	const traceId = crypto.randomUUID();
	const observationId = crypto.randomUUID();
	const startedAt = new Date();
	await db
		.insert(usageTrace)
		.values({ id: traceId, metadata, name, startedAt, status: "running", userId });
	await db.insert(usageObservation).values({
		id: observationId,
		name,
		sequence: 0,
		startedAt,
		status: "running",
		traceId,
		type: "agent",
	});
	return { observationId, traceId };
};

export const startUsageObservation = async ({
	db,
	inputData,
	metadata,
	name,
	parentObservationId,
	traceId,
	type,
}: {
	db: Database;
	inputData?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	name: string;
	parentObservationId?: string;
	traceId: string;
	type: ObservationType;
}) => {
	const latest = await db.query.usageObservation.findFirst({
		columns: { sequence: true },
		orderBy: [desc(usageObservation.sequence)],
		where: eq(usageObservation.traceId, traceId),
	});
	const observationId = crypto.randomUUID();
	await db.insert(usageObservation).values({
		id: observationId,
		inputData,
		metadata,
		name,
		parentObservationId,
		sequence: (latest?.sequence ?? 0) + 1,
		status: "running",
		traceId,
		type,
	});
	return observationId;
};

export const finishUsageTrace = async ({
	db,
	status,
	traceId,
}: {
	db: Database;
	status: "failed" | "succeeded";
	traceId: string;
}) => {
	await db
		.update(usageTrace)
		.set({ endedAt: new Date(), status })
		.where(eq(usageTrace.id, traceId));
};

export const finishUsageObservation = async ({
	db,
	observationId,
	outputData,
	status,
}: {
	db: Database;
	observationId: string;
	outputData?: Record<string, unknown>;
	status: "failed" | "succeeded";
}) => {
	await db
		.update(usageObservation)
		.set({ endedAt: new Date(), outputData, status })
		.where(eq(usageObservation.id, observationId));
};
