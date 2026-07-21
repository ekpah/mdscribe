"use client";

import { cn } from "@repo/design-system/lib/utils";
import { FileText, Info } from "lucide-react";

import { USER_MESSAGES } from "@/lib/user-messages";

export type DocumentPreviewView = "document" | "information";

const getTabClassName = (isActive: boolean) =>
	cn(
		"relative flex h-36 w-10 flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		isActive && "z-10 bg-card text-foreground shadow-md",
	);

export const DocumentPreviewTabs = ({
	activeView,
	onViewChange,
}: {
	activeView: DocumentPreviewView;
	onViewChange: (view: DocumentPreviewView) => void;
}) => (
	<nav
		aria-label={USER_MESSAGES.documentEditor.contentTabsLabel}
		className="absolute right-0 top-4 z-20 flex flex-col items-end gap-1"
	>
		<button
			aria-current={activeView === "document" ? "page" : undefined}
			className={getTabClassName(activeView === "document")}
			onClick={() => onViewChange("document")}
			type="button"
		>
			<FileText aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
			<span className="rotate-180 whitespace-nowrap font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
				{USER_MESSAGES.documentEditor.pdfTabLabel}
			</span>
		</button>
		<button
			aria-current={activeView === "information" ? "page" : undefined}
			className={getTabClassName(activeView === "information")}
			onClick={() => onViewChange("information")}
			type="button"
		>
			<Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
			<span className="rotate-180 whitespace-nowrap font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
				{USER_MESSAGES.documentEditor.informationLabel}
			</span>
		</button>
	</nav>
);
