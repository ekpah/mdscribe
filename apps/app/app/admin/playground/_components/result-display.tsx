"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import {
	AlertCircle,
	Brain,
	Check,
	Clock,
	Coins,
	Copy,
	FileText,
	Hash,
	Loader2,
	Medal,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { EvaluationDetailsDialog } from "@/app/admin/_components/evaluation-details-dialog";
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

const formatLatency = (ms: number | undefined): string => {
	if (ms === undefined || ms === null) {
		return "-";
	}
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
};

const formatScore = (score: number | undefined): string => {
	if (score === undefined || score === null) {
		return "-";
	}
	return score.toFixed(1);
};

interface ResultDisplayProps {
	result: PlaygroundResult | null;
	compact?: boolean;
	onEvaluate?: () => void;
}

export const ResultDisplay = ({ result, compact: _compact, onEvaluate }: ResultDisplayProps) => {
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
			<div className="flex h-full items-center justify-center rounded-lg border border-solarized-base2 bg-solarized-base3/50 p-4">
				<div className="text-center">
					<FileText className="mx-auto h-8 w-8 text-solarized-base01/50" />
					<p className="mt-2 text-sm text-solarized-base01">Antwort erscheint hier</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-2">
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
					</span>
					<span className="flex items-center gap-1 text-solarized-base01">
						<Coins className="h-3 w-3 text-solarized-green" />
						{formatCost(result.metrics.cost)}
					</span>
					<span className="flex items-center gap-1 text-solarized-base01">
						<Hash className="h-3 w-3 text-solarized-cyan" />
						{formatTokens(result.metrics.totalTokens)}
					</span>
					{result.metrics.reasoningTokens ? (
						<span className="flex items-center gap-1 text-solarized-base01">
							<Brain className="h-3 w-3 text-solarized-violet" />
							{formatTokens(result.metrics.reasoningTokens)}
						</span>
					) : null}
					{result.evaluation?.isLoading ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled
							className="h-5 gap-1 px-1 text-xs text-solarized-base01"
						>
							<Loader2 className="h-3 w-3 animate-spin text-solarized-orange" />
							Eval
						</Button>
					) : result.evaluation?.totalScore !== undefined &&
					  result.evaluation.categories.length > 0 ? (
						<EvaluationDetailsDialog
							canRegenerate={Boolean(onEvaluate && !result.isStreaming && result.text)}
							evaluation={result.evaluation}
							onRegenerate={onEvaluate}
							trigger={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={result.isStreaming || !result.text}
									aria-label="Evaluationsdetails anzeigen"
									className="h-5 gap-1 px-1 text-xs text-solarized-base01 hover:text-solarized-base00"
								>
									<Medal className="h-3 w-3 text-solarized-yellow" />
									{formatScore(result.evaluation.totalScore)}
								</Button>
							}
						/>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onEvaluate}
							disabled={!onEvaluate || result.isStreaming || !result.text}
							aria-label="Antwort bewerten"
							className="h-5 gap-1 px-1 text-xs text-solarized-base01 hover:text-solarized-base00"
						>
							<Medal className="h-3 w-3 text-solarized-yellow" />-
						</Button>
					)}
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

			{/* Content */}
			{result.reasoning ? (
				<Tabs defaultValue="output" className="flex min-h-0 flex-1 flex-col">
					<TabsList className="h-7 w-fit">
						<TabsTrigger value="output" className="h-5 px-2 text-xs">
							Ausgabe
						</TabsTrigger>
						<TabsTrigger value="reasoning" className="h-5 gap-1 px-2 text-xs">
							<Brain className="h-3 w-3" />
							Reasoning
						</TabsTrigger>
					</TabsList>

					<TabsContent value="output" className="mt-1 min-h-0 flex-1 data-[state=inactive]:hidden">
						<ScrollArea className="h-full rounded-md border border-solarized-base2 bg-solarized-base3">
							<div className="whitespace-pre-wrap p-3 font-mono text-sm text-solarized-base00">
								{result.text || (
									<span className="text-solarized-base01 italic">Warte auf Antwort...</span>
								)}
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent
						value="reasoning"
						className="mt-1 min-h-0 flex-1 data-[state=inactive]:hidden"
					>
						<ScrollArea className="h-full rounded-md border border-solarized-violet/30 bg-solarized-violet/5">
							<div className="whitespace-pre-wrap p-3 font-mono text-sm text-solarized-base01 italic">
								{result.reasoning}
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			) : (
				<ScrollArea className="min-h-0 flex-1 rounded-md border border-solarized-base2 bg-solarized-base3">
					<div className="whitespace-pre-wrap p-3 font-mono text-sm text-solarized-base00">
						{result.text || (
							<span className="text-solarized-base01 italic">Warte auf Antwort...</span>
						)}
					</div>
				</ScrollArea>
			)}
		</div>
	);
};
