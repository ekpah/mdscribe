"use client";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Code, Pencil } from "lucide-react";

export default function PlainEditor({
	note,
	setContent,
	showSource,
	onToggleSource,
}: {
	note: string;
	setContent: (content: string) => void;
	showSource?: boolean;
	onToggleSource?: () => void;
}) {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			{/* Menu bar matching TipTapMenu height */}
			<div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-muted/90 p-2">
				<div className="flex flex-wrap gap-1">
					<TooltipProvider>
						<Tooltip delayDuration={200}>
							<TooltipTrigger className="h-8 bg-transparent px-2 text-muted-foreground">
								<span className="font-mono text-sm">Markdoc Quelltext</span>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>Bearbeite den Markdoc-Quelltext direkt</p>
								<p className="mt-1">
									<a
										className="text-primary hover:underline"
										href="https://docs.mdscribe.de/templates/tags"
										rel="noopener noreferrer"
										target="_blank"
									>
										Erfahre mehr →
									</a>
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				{/* Source Toggle - Right aligned */}
				{onToggleSource !== undefined && (
					<div className="ml-auto flex items-center">
						<button
							className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium"
							onClick={onToggleSource}
							type="button"
						>
							<Pencil className="h-4 w-4" />
							<span className="hidden sm:inline">Editor anzeigen</span>
						</button>
					</div>
				)}
			</div>

			{/* Editor Content */}
			<div className="min-h-0 flex-1">
				<Textarea
					className="h-full w-full resize-none border-0 p-3 font-mono text-sm focus-visible:ring-0"
					onChange={(e) => setContent(e.target.value)}
					value={note}
				/>
			</div>
		</div>
	);
}
