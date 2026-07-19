"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import {
	AlertCircle,
	Brain,
	Check,
	Clock,
	Coins,
	Copy,
	FileText,
	GitCompareArrows,
	Hash,
	Loader2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { PlaygroundResult } from "@/app/admin/playground/_lib/types";

const formatCost = (cost: number | undefined): string => {
	if (cost === undefined || cost === null) {
		return "-";
	}
	return `$${cost.toFixed(6)}`;
};

const formatTokens = (tokens: number | undefined): string => {
	if (tokens === undefined || tokens === null) {
		return "-";
	}
	return tokens.toLocaleString("de-DE");
};

const formatTokenBreakdown = (metrics: PlaygroundResult["metrics"]): string => {
	const parts = [
		`In ${formatTokens(metrics.inputTokens)}`,
		`Out ${formatTokens(metrics.outputTokens)}`,
	];
	if (metrics.reasoningTokens) {
		parts.push(`Reason ${formatTokens(metrics.reasoningTokens)}`);
	}
	return parts.join(" · ");
};

const formatLatency = (ms: number | undefined): string => {
	if (ms === undefined || ms === null) {
		return "-";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
};

const formatTokensPerSecond = (
	outputTokens: number | undefined,
	latencyMs: number | undefined,
): string | null => {
	if (!outputTokens || !latencyMs || latencyMs <= 0) {
		return null;
	}
	return `${(outputTokens / (latencyMs / 1000)).toLocaleString("de-DE", {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
	})} Tok/s`;
};

interface ResultDisplayProps {
	result: PlaygroundResult | null;
	compact?: boolean;
	onCompare?: () => void;
}

const renderComparisonAction = (result: PlaygroundResult, onCompare: (() => void) | undefined) => {
	if (!onCompare) {
		return null;
	}

	if (result.comparison?.isLoading) {
		return (
			<Button
				className="h-5 gap-1 px-1 text-solarized-base01 text-xs"
				disabled
				size="sm"
				type="button"
				variant="ghost"
			>
				<Loader2 className="h-3 w-3 animate-spin text-solarized-orange" />
				Vergleich
			</Button>
		);
	}

	return (
		<Button
			aria-label="Antwort vergleichen"
			className="h-5 gap-1 px-1 text-solarized-base01 text-xs hover:text-solarized-base00"
			disabled={result.isStreaming || !result.text}
			onClick={onCompare}
			size="sm"
			type="button"
			variant="ghost"
		>
			<GitCompareArrows className="h-3 w-3 text-solarized-cyan" />
			{result.comparison?.preferredResponse ? "Erneut" : "Vergleichen"}
		</Button>
	);
};

const ComparisonResult = ({ comparison }: { comparison: NonNullable<PlaygroundResult["comparison"]> }) => {
	if (comparison.isLoading || !comparison.preferredResponse || !comparison.note) {
		return null;
	}

	const isResultPreferred = comparison.preferredResponse === "result";
	const summary = isResultPreferred
		? `Dieses Ergebnis wird gegenüber ${comparison.referenceLabel} bevorzugt.`
		: `${comparison.referenceLabel} wird gegenüber diesem Ergebnis bevorzugt.`;

	return (
		<div
			className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${
				isResultPreferred
					? "border-solarized-green/30 bg-solarized-green/10 text-solarized-green"
					: "border-solarized-orange/30 bg-solarized-orange/10 text-solarized-orange"
			}`}
		>
			<GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0" />
			<div>
				<p className="font-medium">{summary}</p>
				<p className="mt-0.5 opacity-90">{comparison.note}</p>
			</div>
		</div>
	);
};

export const ResultDisplay = ({ result, compact: _compact, onCompare }: ResultDisplayProps) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		if (!result?.text) {
			return;
		}
		await navigator.clipboard.writeText(result.text);
		setCopied(true);
		toast.success("Kopiert!");
		setTimeout(() => setCopied(false), 2000);
	}, [result?.text]);

	if (!result) {
		return (
			<div className="flex items-center justify-center rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-6">
				<div className="text-center">
					<FileText className="mx-auto h-8 w-8 text-solarized-base01/50" />
					<p className="mt-2 text-sm text-solarized-base01">Antwort erscheint hier</p>
				</div>
			</div>
		);
	}

	const tokensPerSecond = formatTokensPerSecond(
		result.metrics.outputTokens,
		result.metrics.latencyMs,
	);

	return (
		<div className="flex flex-col gap-2">
			{/* Header with metrics */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
					{result.sourceLabel ? (
						<Badge variant="outline" className="h-5 px-1.5 text-[10px]">
							{result.sourceLabel}
						</Badge>
					) : null}
					{result.modelLabel ? (
						<span className="max-w-[220px] truncate font-mono text-solarized-base01">
							{result.modelLabel}
						</span>
					) : null}
					{result.isStreaming && (
						<Badge
							variant="outline"
							className="h-5 gap-1 border-solarized-blue px-1.5 text-[10px] text-solarized-blue"
						>
							<Loader2 className="h-2.5 w-2.5 animate-spin" />
							Streaming
						</Badge>
					)}
					<span className="flex items-center gap-1 text-solarized-base01">
						<Clock className="h-3 w-3 text-solarized-blue" />
						{formatLatency(result.metrics.latencyMs)}
						{tokensPerSecond ? <span>· {tokensPerSecond}</span> : null}
					</span>
					<span className="flex items-center gap-1 text-solarized-base01">
						<Coins className="h-3 w-3 text-solarized-green" />
						{formatCost(result.metrics.cost)}
					</span>
					<span className="flex items-center gap-1 text-solarized-base01">
						<Hash className="h-3 w-3 text-solarized-cyan" />
						{formatTokenBreakdown(result.metrics)}
					</span>
					{renderComparisonAction(result, onCompare)}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={handleCopy}
					disabled={!result.text || result.isStreaming}
					className="h-6 gap-1 px-2 text-xs text-solarized-base01 hover:text-solarized-base00"
				>
					{copied ? (
						<Check className="h-3 w-3 text-solarized-green" />
					) : (
						<Copy className="h-3 w-3" />
					)}
					Kopieren
				</Button>
			</div>

			{/* Error Display */}
			{result.error && (
				<div className="flex items-start gap-2 rounded-md border border-solarized-red/30 bg-solarized-red/10 p-2">
					<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-solarized-red" />
					<div className="text-xs text-solarized-red">{result.error}</div>
				</div>
			)}

			{result.comparison ? <ComparisonResult comparison={result.comparison} /> : null}

			{/* Content - grows with the response instead of stretching to a fixed card height */}
			{result.reasoning ? (
				<Tabs defaultValue="output" className="flex flex-col">
					<TabsList className="h-7 w-fit">
						<TabsTrigger value="output" className="h-5 px-2 text-xs">
							Ausgabe
						</TabsTrigger>
						<TabsTrigger value="reasoning" className="h-5 gap-1 px-2 text-xs">
							<Brain className="h-3 w-3" />
							Reasoning
						</TabsTrigger>
					</TabsList>

					<TabsContent value="output" className="mt-1 data-hidden:hidden">
						<div className="whitespace-pre-wrap rounded-md border border-solarized-base2 bg-solarized-base3 p-3 font-mono text-sm text-solarized-base00">
							{result.text || (
								<span className="text-solarized-base01 italic">Warte auf Antwort...</span>
							)}
						</div>
					</TabsContent>

					<TabsContent value="reasoning" className="mt-1 data-hidden:hidden">
						<div className="whitespace-pre-wrap rounded-md border border-solarized-violet/30 bg-solarized-violet/5 p-3 font-mono text-sm text-solarized-base01 italic">
							{result.reasoning}
						</div>
					</TabsContent>
				</Tabs>
			) : (
				<div className="whitespace-pre-wrap rounded-md border border-solarized-base2 bg-solarized-base3 p-3 font-mono text-sm text-solarized-base00">
					{result.text || (
						<span className="text-solarized-base01 italic">Warte auf Antwort...</span>
					)}
				</div>
			)}
		</div>
	);
};
