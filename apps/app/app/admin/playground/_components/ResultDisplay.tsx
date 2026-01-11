"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PlaygroundResult } from "../_lib/types";
import { formatCost, formatLatency, formatTokens } from "../_lib/types";

interface ResultDisplayProps {
	result: PlaygroundResult | null;
	modelName?: string;
}

export function ResultDisplay({ result, modelName }: ResultDisplayProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!result?.text) return;
		await navigator.clipboard.writeText(result.text);
		setCopied(true);
		toast.success("Kopiert!");
		setTimeout(() => setCopied(false), 2000);
	};

	if (!result) {
		return (
			<Card className="h-full border-solarized-base2 bg-solarized-base3/50">
				<CardContent className="flex h-full items-center justify-center p-6">
					<div className="text-center">
						<FileText className="mx-auto h-12 w-12 text-solarized-base01/50" />
						<p className="mt-4 text-solarized-base01">
							Die Antwort des Modells erscheint hier
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex h-full flex-col border-solarized-base2">
			<CardHeader className="flex-row items-center justify-between space-y-0 border-b border-solarized-base2 pb-3">
				<div className="flex items-center gap-2">
					<CardTitle className="text-base text-solarized-base00">
						Ergebnis
					</CardTitle>
					{modelName && (
						<Badge variant="outline" className="font-mono text-xs">
							{modelName}
						</Badge>
					)}
					{result.isStreaming && (
						<Badge
							variant="outline"
							className="gap-1 border-solarized-blue text-solarized-blue"
						>
							<Loader2 className="h-3 w-3 animate-spin" />
							Streaming...
						</Badge>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleCopy}
					disabled={!result.text || result.isStreaming}
					className="h-8 gap-2 text-solarized-base01 hover:text-solarized-base00"
				>
					{copied ? (
						<Check className="h-4 w-4 text-solarized-green" />
					) : (
						<Copy className="h-4 w-4" />
					)}
					Kopieren
				</Button>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
				{/* Metrics Bar */}
				<div className="flex flex-wrap gap-3 rounded-lg bg-solarized-base2/30 px-3 py-2">
					<div className="flex items-center gap-1.5 text-sm">
						<Clock className="h-4 w-4 text-solarized-blue" />
						<span className="text-solarized-base01">Latenz:</span>
						<span className="font-mono text-solarized-base00">
							{formatLatency(result.metrics.latencyMs)}
						</span>
					</div>
					<div className="flex items-center gap-1.5 text-sm">
						<Coins className="h-4 w-4 text-solarized-green" />
						<span className="text-solarized-base01">Kosten:</span>
						<span className="font-mono text-solarized-base00">
							{formatCost(result.metrics.cost)}
						</span>
					</div>
					<div className="flex items-center gap-1.5 text-sm">
						<Hash className="h-4 w-4 text-solarized-cyan" />
						<span className="text-solarized-base01">Tokens:</span>
						<span className="font-mono text-solarized-base00">
							{formatTokens(result.metrics.totalTokens)}
						</span>
					</div>
					{result.metrics.reasoningTokens && (
						<div className="flex items-center gap-1.5 text-sm">
							<Brain className="h-4 w-4 text-solarized-violet" />
							<span className="text-solarized-base01">Reasoning:</span>
							<span className="font-mono text-solarized-base00">
								{formatTokens(result.metrics.reasoningTokens)}
							</span>
						</div>
					)}
				</div>

				{/* Error Display */}
				{result.error && (
					<div className="flex items-start gap-2 rounded-lg border border-solarized-red/30 bg-solarized-red/10 p-3">
						<AlertCircle className="mt-0.5 h-4 w-4 text-solarized-red" />
						<div className="text-sm text-solarized-red">{result.error}</div>
					</div>
				)}

				{/* Content Tabs */}
				{(result.text || result.reasoning) && (
					<Tabs
						defaultValue="output"
						className="flex flex-1 flex-col overflow-hidden"
					>
						<TabsList className="w-fit">
							<TabsTrigger value="output">Ausgabe</TabsTrigger>
							{result.reasoning && (
								<TabsTrigger value="reasoning" className="gap-1.5">
									<Brain className="h-3.5 w-3.5" />
									Reasoning
								</TabsTrigger>
							)}
						</TabsList>

						<TabsContent
							value="output"
							className="mt-2 flex-1 overflow-hidden data-[state=inactive]:hidden"
						>
							<ScrollArea className="h-full rounded-lg border border-solarized-base2 bg-solarized-base3 p-4">
								<div className="whitespace-pre-wrap font-mono text-sm text-solarized-base00">
									{result.text || (
										<span className="text-solarized-base01 italic">
											Warte auf Antwort...
										</span>
									)}
								</div>
							</ScrollArea>
						</TabsContent>

						{result.reasoning && (
							<TabsContent
								value="reasoning"
								className="mt-2 flex-1 overflow-hidden data-[state=inactive]:hidden"
							>
								<ScrollArea className="h-full rounded-lg border border-solarized-violet/30 bg-solarized-violet/5 p-4">
									<div className="whitespace-pre-wrap font-mono text-sm text-solarized-base01 italic">
										{result.reasoning}
									</div>
								</ScrollArea>
							</TabsContent>
						)}
					</Tabs>
				)}
			</CardContent>
		</Card>
	);
}
