import type { Database } from "@repo/database";
import type { JSONValue } from "ai";

import type { Session } from "@/lib/auth-types";
import { finishUsageObservation, startUsageObservation } from "@/lib/usage-tracing";
import type { ResolvedDefaultModelSelection } from "@/orpc/scribe/providers";
import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

import type { PreparedAgentMedia } from "../lib/prepare-media";
import type { ScribeAgentSection } from "../types";

/**
 * Everything a tool needs to act on the current letter and to run the standard
 * model. Shared across all agent tools so adding a new tool is just one file.
 */
export interface AgentToolDeps {
	agentRunId: string;
	rootObservationId: string;
	traceId: string;
	db: Database;
	userId: string;
	session: Session;
	activeSubscription: boolean;
	audioFiles: AudioFile[];
	contextFiles: FillInputsContextFile[];
	sections: ScribeAgentSection[];
	preparedMedia: PreparedAgentMedia;
	generation: ResolvedDefaultModelSelection;
	providerOptions: Record<string, Record<string, JSONValue>> | undefined;
	temperature?: number;
	toolTrace: AgentToolTraceEntry[];
}

/**
 * Result shape every section-mutating tool returns. The client applies the
 * `content` to `sectionId` when `ok` is true.
 */
export interface SectionToolResult {
	ok: boolean;
	sectionId?: string;
	content?: string;
	error?: string;
}

type AgentToolName = "editSection" | "generateSection";

export interface AgentToolTraceEntry {
	durationMs: number;
	error?: string;
	name: AgentToolName;
	ok: boolean;
	resultCharacters?: number;
	sectionId?: string;
}

const recordToolTrace = (trace: AgentToolTraceEntry[], entry: AgentToolTraceEntry): void => {
	trace.push({
		...entry,
		durationMs: Math.max(0, Math.round(entry.durationMs)),
	});
};

/**
 * Persist every agent tool invocation as a child observation. Tool inputs stay
 * structural: clinical find/replace text must never enter trace metadata.
 */
export const runTracedTool = async ({
	deps,
	execute,
	inputData,
	metadata,
	name,
	sectionId,
}: {
	deps: AgentToolDeps;
	execute: (toolObservationId: string) => Promise<SectionToolResult> | SectionToolResult;
	inputData: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	name: AgentToolName;
	sectionId: string;
}): Promise<SectionToolResult> => {
	const startedAt = Date.now();
	const toolObservationId = await startUsageObservation({
		db: deps.db,
		inputData: deps.activeSubscription ? { redacted: true } : inputData,
		metadata: { sectionId, ...metadata },
		name,
		parentObservationId: deps.rootObservationId,
		traceId: deps.traceId,
		type: "tool",
	});

	try {
		const result = await execute(toolObservationId);
		await finishUsageObservation({
			db: deps.db,
			observationId: toolObservationId,
			outputData: deps.activeSubscription
				? { redacted: true }
				: { content: result.content, error: result.error, ok: result.ok },
			status: result.ok ? "succeeded" : "failed",
		});
		recordToolTrace(deps.toolTrace, {
			durationMs: Date.now() - startedAt,
			error: result.ok ? undefined : "tool-rejected",
			name,
			ok: result.ok,
			resultCharacters: result.content?.length,
			sectionId,
		});
		return result;
	} catch (error) {
		await finishUsageObservation({
			db: deps.db,
			observationId: toolObservationId,
			outputData: { error: "tool-execution-failed", ok: false },
			status: "failed",
		});
		recordToolTrace(deps.toolTrace, {
			durationMs: Date.now() - startedAt,
			error: "tool-execution-failed",
			name,
			ok: false,
			sectionId,
		});
		throw error;
	}
};

export const findSection = (deps: AgentToolDeps, sectionId: string) =>
	deps.sections.find((section) => section.id === sectionId);
