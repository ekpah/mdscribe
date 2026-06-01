"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { FlaskConical, Loader2, Medal } from "lucide-react";
import Link from "next/link";

import { EvaluationDetailsDialog } from "@/app/admin/_components/evaluation-details-dialog";
import {
	allScribeDocTypes,
	isScribeDocType,
	scribeDocTypeUi,
} from "@/app/admin/playground/_lib/scribe-doc-types";
import {
	formatDuration,
	formatScore,
	formatTokensPerSecond,
	getUsageEvaluation,
} from "@/app/admin/usage/columns";
import type { UsageDetailEvent } from "@/app/admin/usage/types";
import type { DocumentType } from "@/orpc/scribe/types";

const promptNameToDocumentType = new Map(
	allScribeDocTypes.map((documentType) => [
		scribeDocTypeUi[documentType].defaultPromptName,
		documentType,
	]),
);

const inferDocumentType = (metadata: Record<string, unknown> | null): DocumentType | undefined => {
	if (!metadata) {
		return undefined;
	}

	const { endpoint } = metadata;
	if (typeof endpoint === "string" && endpoint.trim().length > 0 && isScribeDocType(endpoint)) {
		return endpoint;
	}

	const { promptName } = metadata;
	if (typeof promptName === "string" && promptName.trim().length > 0) {
		return promptNameToDocumentType.get(promptName);
	}

	return undefined;
};

const buildPlaygroundUrl = (event: UsageDetailEvent): string => {
	const params = new URLSearchParams();

	// Use referenceUsageEvent for persistent URL state
	params.set("referenceUsageEvent", event.id);

	if (event.model) {
		params.set("model", event.model);
	}

	// Prefer inferring document type from metadata (if present)
	const metadata = event.metadata as Record<string, unknown> | null;
	const documentType = inferDocumentType(metadata);
	if (documentType) {
		params.set("documentType", documentType);
	}

	// Extract parameters from metadata
	if (metadata) {
		const modelConfig = metadata.modelConfig as Record<string, unknown> | undefined;
		if (modelConfig?.temperature !== undefined) {
			params.set("temperature", String(modelConfig.temperature));
		}
		if (modelConfig?.maxTokens !== undefined) {
			params.set("maxTokens", String(modelConfig.maxTokens));
		}
		if (metadata.thinkingEnabled) {
			params.set("thinking", "true");
			if (typeof metadata.reasoningEffort === "string") {
				params.set("reasoningEffort", metadata.reasoningEffort);
			}
		}
	}

	return `/admin/playground?${params.toString()}`;
};

interface UsageEventDetailProps {
	event: UsageDetailEvent | null | undefined;
	isEvaluating?: boolean;
	onEvaluate?: (id: string) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const StatBox = ({ label, value }: { label: string; value: string | number | null }) => (
	<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-2">
		<p className="text-xs text-solarized-base01">{label}</p>
		<p className="font-mono text-sm text-solarized-base00">
			{typeof value === "number" ? value.toLocaleString("de-DE") : (value ?? "-")}
		</p>
	</div>
);

const formatDate = (date: Date | string) => {
	const dateObj = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		year: "numeric",
	}).format(dateObj);
};

export const UsageEventDetail = ({
	event,
	isEvaluating = false,
	onEvaluate,
	open,
	onOpenChange,
}: UsageEventDetailProps) => {
	if (!event) {
		return null;
	}

	const cost = event.cost ? Number(event.cost) : null;
	const evaluation = getUsageEvaluation(event.metadata);
	const canEvaluate = Boolean(onEvaluate && event.result && !isEvaluating);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>Event-Details</SheetTitle>
					<SheetDescription>{formatDate(event.timestamp)}</SheetDescription>
				</SheetHeader>

				{/* Jump to Playground Button */}
				<div className="mt-4">
					<Button
						asChild
						variant="outline"
						className="w-full gap-2 border-solarized-violet/30 bg-solarized-violet/10 text-solarized-violet hover:bg-solarized-violet/20"
					>
						<Link href={buildPlaygroundUrl(event)}>
							<FlaskConical className="h-4 w-4" />
							Im Playground öffnen
						</Link>
					</Button>
				</div>

				<div className="mt-6 space-y-6">
					{/* User Info Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">Benutzer</h3>
						<div className="rounded-lg border border-solarized-base2 p-3">
							{event.user ? (
								<>
									<p className="font-medium text-solarized-base00">
										{event.user.name || "Kein Name"}
									</p>
									<p className="text-sm text-solarized-base01">{event.user.email}</p>
								</>
							) : (
								<p className="text-solarized-base01">Unbekannter Benutzer</p>
							)}
						</div>
					</section>

					{/* Action & Model Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">Aktion & Modell</h3>
						<div className="space-y-2 rounded-lg border border-solarized-base2 p-3">
							<div className="flex justify-between">
								<span className="text-solarized-base01">Aktion</span>
								<span className="font-mono text-sm text-solarized-base00">{event.name}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-solarized-base01">Modell</span>
								<span className="font-mono text-sm text-solarized-base00">
									{event.model || "-"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-solarized-base01">Kosten</span>
								<span className="font-mono text-sm text-solarized-base00">
									{cost === null ? "-" : `$${cost.toFixed(6)}`}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-solarized-base01">Score</span>
								{evaluation ? (
									<EvaluationDetailsDialog
										canRegenerate={canEvaluate}
										evaluation={evaluation}
										isRegenerating={isEvaluating}
										onRegenerate={() => onEvaluate?.(event.id)}
										trigger={
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 gap-1 px-2 font-mono text-sm text-solarized-base00"
											>
												<Medal className="h-3.5 w-3.5 text-solarized-yellow" />
												{formatScore(evaluation.totalScore)}
											</Button>
										}
									/>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={!canEvaluate}
										onClick={() => onEvaluate?.(event.id)}
										className="h-7 gap-1 px-2 font-mono text-sm text-solarized-base00"
									>
										{isEvaluating ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin text-solarized-orange" />
										) : (
											<Medal className="h-3.5 w-3.5 text-solarized-yellow" />
										)}
											{isEvaluating ? "..." : formatScore()}
									</Button>
								)}
							</div>
						</div>
					</section>

					{/* Token Usage Section */}
					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">Token-Nutzung</h3>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							<StatBox label="Input" value={event.inputTokens} />
							<StatBox label="Output" value={event.outputTokens} />
							<StatBox label="Gesamt" value={event.totalTokens} />
							<StatBox label="Reasoning" value={event.reasoningTokens} />
							<StatBox label="Cached" value={event.cachedTokens} />
						</div>
					</section>

					<section>
						<h3 className="mb-2 font-medium text-solarized-base00">Latenz & Durchsatz</h3>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							<StatBox label="Erster Token" value={formatDuration(event.timeToFirstTokenMs)} />
							<StatBox label="Fertig" value={formatDuration(event.timeToCompletionMs)} />
							<StatBox
								label="Tokens/s"
								value={formatTokensPerSecond(event.outputTokens, event.timeToCompletionMs)}
							/>
						</div>
					</section>

					{/* Input Data Section (JSON) */}
					{event.inputData !== null && event.inputData !== undefined && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">Eingabedaten</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<pre className="whitespace-pre-wrap p-3 font-mono text-xs">
									{JSON.stringify(event.inputData, null, 2)}
								</pre>
							</div>
						</section>
					)}

					{/* Metadata Section (JSON) */}
					{event.metadata !== null && event.metadata !== undefined && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">Metadaten</h3>
							<div className="max-h-32 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<pre className="whitespace-pre-wrap p-3 font-mono text-xs">
									{JSON.stringify(event.metadata, null, 2)}
								</pre>
							</div>
						</section>
					)}

					{/* Result Section (Text) */}
					{event.result && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">Ergebnis</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<div className="whitespace-pre-wrap p-3 text-sm">{event.result}</div>
							</div>
						</section>
					)}

					{/* Reasoning Section (Text) */}
					{event.reasoning && (
						<section>
							<h3 className="mb-2 font-medium text-solarized-base00">Reasoning</h3>
							<div className="max-h-48 overflow-auto rounded-lg border border-solarized-base2 bg-solarized-base3">
								<div className="whitespace-pre-wrap p-3 text-sm italic text-solarized-base01">
									{event.reasoning}
								</div>
							</div>
						</section>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
