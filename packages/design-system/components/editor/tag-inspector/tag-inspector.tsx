"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import { Calculator, Code2, CornerDownRight, Info, X } from "lucide-react";

import { CaseTagPanel } from "./case-tag-panel";
import { TagInspectorHelp } from "./help-content";
import { InfoTagPanel } from "./info-tag-panel";
import { ScoreTagPanel } from "./score-tag-panel";
import { SwitchTagPanel } from "./switch-tag-panel";
import type { MarkdocTagKind, SelectedMarkdocTag } from "./use-selected-markdoc-tag";
import { useSelectedMarkdocTag } from "./use-selected-markdoc-tag";

export type { Editor as TagInspectorEditor } from "@tiptap/react";

export const TAG_PANEL_META: Record<
	MarkdocTagKind,
	{ icon: LucideIcon; iconClassName: string; iconWrapClassName: string; label: string }
> = {
	caseTag: {
		icon: CornerDownRight,
		iconClassName: "text-solarized-cyan",
		iconWrapClassName: "bg-solarized-cyan/15",
		label: "Case",
	},
	infoTag: {
		icon: Info,
		iconClassName: "text-solarized-blue",
		iconWrapClassName: "bg-solarized-blue/15",
		label: "Info",
	},
	scoreTag: {
		icon: Calculator,
		iconClassName: "text-solarized-orange",
		iconWrapClassName: "bg-solarized-orange/15",
		label: "Score",
	},
	switchTag: {
		icon: Code2,
		iconClassName: "text-solarized-green",
		iconWrapClassName: "bg-solarized-green/15",
		label: "Switch",
	},
};

export const TagPanelBody = ({
	editor,
	selectedTag,
}: {
	editor: Editor;
	selectedTag: SelectedMarkdocTag;
}) => {
	switch (selectedTag.kind) {
		case "caseTag":
			return <CaseTagPanel editor={editor} node={selectedTag.node} pos={selectedTag.pos} />;
		case "infoTag":
			return <InfoTagPanel editor={editor} node={selectedTag.node} pos={selectedTag.pos} />;
		case "scoreTag":
			return <ScoreTagPanel editor={editor} node={selectedTag.node} pos={selectedTag.pos} />;
		case "switchTag":
			return <SwitchTagPanel editor={editor} node={selectedTag.node} pos={selectedTag.pos} />;
		default:
			return null;
	}
};

/**
 * Figma-style properties sidebar for the template editor: shows tag help when
 * nothing is selected and the selected tag's properties otherwise.
 */
export const TagInspector = ({
	className,
	editor,
}: {
	className?: string;
	editor: Editor | null;
}) => {
	const { clearSelectedTag, selectedTag } = useSelectedMarkdocTag(editor);
	const meta = selectedTag ? TAG_PANEL_META[selectedTag.kind] : null;

	return (
		<Card className={cn("flex h-full flex-col overflow-hidden", className)}>
			{selectedTag && meta && editor ? (
				<>
					<div className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
						<span
							className={cn(
								"flex h-7 w-7 items-center justify-center rounded-sm",
								meta.iconWrapClassName,
							)}
						>
							<meta.icon className={cn("h-4 w-4", meta.iconClassName)} />
						</span>
						<div className="min-w-0">
							<p className="font-semibold text-sm leading-tight">{meta.label}-Tag</p>
							<p className="text-muted-foreground text-xs">Eigenschaften</p>
						</div>
						<Button
							aria-label="Eigenschaften schließen"
							className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
							onClick={clearSelectedTag}
							size="icon"
							variant="ghost"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<ScrollArea className="min-h-0 flex-1">
						<div className="p-4">
							<TagPanelBody
								editor={editor}
								key={`${selectedTag.kind}-${selectedTag.pos}`}
								selectedTag={selectedTag}
							/>
						</div>
					</ScrollArea>
				</>
			) : (
				<ScrollArea className="min-h-0 flex-1">
					<div className="p-4">
						<TagInspectorHelp />
					</div>
				</ScrollArea>
			)}
		</Card>
	);
};
