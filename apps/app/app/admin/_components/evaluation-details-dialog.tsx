"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Loader2, Medal, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export interface EvaluationDetails {
	categories: {
		comment?: string;
		name: string;
		score: number;
	}[];
	evaluatedAt?: string;
	summary?: string;
	totalScore?: number;
}

const formatScore = (score: number | undefined): string =>
	score === undefined ? "-" : score.toFixed(1);

const formatEvaluatedAt = (evaluatedAt: string | undefined): string | null => {
	if (!evaluatedAt) {
		return null;
	}

	const date = new Date(evaluatedAt);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
};

interface EvaluationDetailsDialogProps {
	canRegenerate?: boolean;
	evaluation: EvaluationDetails;
	isRegenerating?: boolean;
	onRegenerate?: () => void;
	trigger: ReactNode;
}

export const EvaluationDetailsDialog = ({
	canRegenerate = true,
	evaluation,
	isRegenerating = false,
	onRegenerate,
	trigger,
}: EvaluationDetailsDialogProps) => {
	const evaluatedAt = formatEvaluatedAt(evaluation.evaluatedAt);

	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Medal className="h-4 w-4 text-solarized-yellow" />
						Evaluationsdetails
					</DialogTitle>
					<DialogDescription>
						Gesamt-Score {formatScore(evaluation.totalScore)} von 10
						{evaluatedAt ? `, berechnet am ${evaluatedAt}` : ""}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-md border border-solarized-base2 bg-solarized-base3 p-3">
						<div className="flex items-baseline justify-between gap-3">
							<span className="text-sm text-solarized-base01">Gesamt-Score</span>
							<span className="font-mono text-2xl text-solarized-base00">
								{formatScore(evaluation.totalScore)}
							</span>
						</div>
						{evaluation.summary ? (
							<p className="mt-3 whitespace-pre-wrap text-sm text-solarized-base00">
								{evaluation.summary}
							</p>
						) : null}
					</div>

					<div className="space-y-2">
						{evaluation.categories.map((category) => (
							<div
								key={category.name}
								className="rounded-md border border-solarized-base2 p-3"
							>
								<div className="flex items-start justify-between gap-4">
									<span className="text-sm leading-snug text-solarized-base00">
										{category.name}
									</span>
									<span className="shrink-0 font-mono text-sm text-solarized-base00">
										{formatScore(category.score)}
									</span>
								</div>
								{category.comment ? (
									<p className="mt-2 text-xs leading-relaxed text-solarized-base01">
										{category.comment}
									</p>
								) : null}
							</div>
						))}
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						onClick={onRegenerate}
						disabled={!canRegenerate || isRegenerating || !onRegenerate}
						className="gap-2"
					>
						{isRegenerating ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RotateCcw className="h-4 w-4" />
						)}
						Neu generieren
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
