import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Pencil } from "lucide-react";

export default function PlainEditor({
	note,
	setContent: _setContent,
	showSource: _showSource,
	onToggleSource,
}: {
	note: string;
	setContent: (content: string) => void;
	showSource?: boolean;
	onToggleSource?: () => void;
}) {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			<div className="flex items-center gap-2 overflow-x-auto border-b border-b-solarized-blue/30 bg-solarized-blue/5 px-2 py-1.5">
				<div className="flex flex-wrap items-center gap-0.5">
					<TooltipProvider>
						<Tooltip delayDuration={200}>
							<TooltipTrigger
								className="inline-flex h-7 items-center rounded-xs px-2 text-muted-foreground text-xs hover:bg-solarized-blue/10 hover:text-foreground"
							>
								<span className="font-mono">Markdoc Quelltext</span>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>Markdoc-Quelltext ansehen</p>
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

				{onToggleSource !== undefined && (
					<div className="ml-auto flex items-center">
						<button
							className="inline-flex h-7 items-center gap-1.5 rounded-xs border border-solarized-blue/20 bg-background/80 px-2 text-xs font-medium text-foreground transition-colors hover:bg-solarized-blue/10"
							onClick={onToggleSource}
							type="button"
						>
							<Pencil className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Editor anzeigen</span>
						</button>
					</div>
				)}
			</div>

			<div className="min-h-0 flex-1">
				<Textarea
					className="h-full w-full resize-none border-0 bg-muted/20 p-3 font-mono text-muted-foreground text-sm focus-visible:ring-0"
					readOnly
					value={note}
				/>
			</div>
		</div>
	);
}
