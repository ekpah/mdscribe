import { Button } from "@repo/design-system/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type { Editor } from "@tiptap/react";
import {
	Bold,
	Heading1,
	Heading2,
	Heading3,
	HelpCircle,
	Italic,
	List,
	Redo,
	Undo,
} from "lucide-react";

import { getPrimaryFromSelection } from "./editor-helpers/get-primary-from-selection";
import { selectInsertedInlineTag } from "./editor-helpers/select-inserted-inline-tag";

const MenuBar = ({ editor }: { editor: Editor | null }) => {
	if (!editor) {
		return null;
	}

	const toolbarButtonClassName =
		"h-7 w-7 rounded-xs px-0 text-foreground/75 hover:bg-solarized-blue/10 hover:text-foreground";
	const activeToolbarButtonClassName =
		"bg-solarized-blue/15 text-solarized-blue hover:bg-solarized-blue/20 hover:text-solarized-blue";
	const tagButtonClassName =
		"h-7 rounded-xs px-2 text-[11px] font-semibold text-white transition-colors hover:text-white";
	const separatorClassName = "mx-0.5 h-5 w-px bg-solarized-blue/20";

	const handlers = {
		handleInsertInfoTag() {
			const selectedPrimary = getPrimaryFromSelection(editor.state);
			editor
				.chain()
				.focus()
				.insertContent({
					attrs: { primary: selectedPrimary ?? "..." },
					type: "infoTag",
				})
				.command(selectInsertedInlineTag)
				.run();
		},
		handleInsertScoreTag() {
			const selectedPrimary = getPrimaryFromSelection(editor.state);
			editor
				.chain()
				.focus()
				.insertContent({
					attrs: {
						formula: "",
						primary: selectedPrimary,
						unit: "",
					},
					type: "scoreTag",
				})
				.command(selectInsertedInlineTag)
				.run();
		},
		handleInsertSwitchTag() {
			const selectedPrimary = getPrimaryFromSelection(editor.state);
			editor
				.chain()
				.focus()
				.insertContent({
					attrs: {
						cases: [{ primary: "", text: "..." }],
						primary: selectedPrimary ?? "...",
					},
					type: "switchTag",
				})
				.command(selectInsertedInlineTag)
				.run();
		},
		handleRedo() {
			editor.chain().focus().redo().run();
		},
		handleToggleBold() {
			editor.chain().focus().toggleBold().run();
		},
		handleToggleBulletList() {
			editor.chain().focus().toggleBulletList().run();
		},
		handleToggleH1() {
			editor.chain().focus().toggleHeading({ level: 1 }).run();
		},
		handleToggleH2() {
			editor.chain().focus().toggleHeading({ level: 2 }).run();
		},
		handleToggleH3() {
			editor.chain().focus().toggleHeading({ level: 3 }).run();
		},
		handleToggleItalic() {
			editor.chain().focus().toggleItalic().run();
		},
		handleUndo() {
			editor.chain().focus().undo().run();
		},
	};

	return (
		<div className="flex items-center gap-2 overflow-x-auto border-b border-b-solarized-blue/30 bg-solarized-blue/5 px-2 py-1.5">
			<div className="flex flex-wrap items-center gap-0.5">
				<Button
					aria-label="Fett"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("bold") && activeToolbarButtonClassName,
					)}
					disabled={!editor.can().chain().focus().toggleBold().run()}
					onClick={handlers.handleToggleBold}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Bold className="h-3.5 w-3.5" />
				</Button>
				<Button
					aria-label="Kursiv"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("italic") && activeToolbarButtonClassName,
					)}
					disabled={!editor.can().chain().focus().toggleItalic().run()}
					onClick={handlers.handleToggleItalic}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Italic className="h-3.5 w-3.5" />
				</Button>

				<div className={separatorClassName} />

				<Button
					aria-label="Überschrift 1"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("heading", { level: 1 }) && activeToolbarButtonClassName,
					)}
					onClick={handlers.handleToggleH1}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Heading1 className="h-3.5 w-3.5" />
				</Button>
				<Button
					aria-label="Überschrift 2"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("heading", { level: 2 }) && activeToolbarButtonClassName,
					)}
					onClick={handlers.handleToggleH2}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Heading2 className="h-3.5 w-3.5" />
				</Button>
				<Button
					aria-label="Überschrift 3"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("heading", { level: 3 }) && activeToolbarButtonClassName,
					)}
					onClick={handlers.handleToggleH3}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Heading3 className="h-3.5 w-3.5" />
				</Button>

				<div className={separatorClassName} />

				<Button
					aria-label="Aufzählung"
					className={cn(
						toolbarButtonClassName,
						editor.isActive("bulletList") && activeToolbarButtonClassName,
					)}
					onClick={handlers.handleToggleBulletList}
					size="sm"
					type="button"
					variant="ghost"
				>
					<List className="h-4 w-4" />
				</Button>

				<div className={separatorClassName} />

				<Button
					aria-label="Rückgängig"
					className={toolbarButtonClassName}
					disabled={!editor.can().chain().focus().undo().run()}
					onClick={handlers.handleUndo}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Undo className="h-3.5 w-3.5" />
				</Button>
				<Button
					aria-label="Wiederholen"
					className={toolbarButtonClassName}
					disabled={!editor.can().chain().focus().redo().run()}
					onClick={handlers.handleRedo}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Redo className="h-3.5 w-3.5" />
				</Button>

				<div className={separatorClassName} />

				<Button
					className={cn(tagButtonClassName, "bg-solarized-blue hover:bg-solarized-blue/90")}
					onClick={handlers.handleInsertInfoTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Info</span>
				</Button>
				<Button
					className={cn(tagButtonClassName, "bg-solarized-green hover:bg-solarized-green/90")}
					onClick={handlers.handleInsertSwitchTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Switch</span>
				</Button>
				<Button
					className={cn(tagButtonClassName, "bg-solarized-orange hover:bg-solarized-orange/90")}
					onClick={handlers.handleInsertScoreTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Calc</span>
				</Button>

				<TooltipProvider delay={200}>
					<Tooltip>
						<TooltipTrigger
							className={cn(toolbarButtonClassName, "inline-flex items-center justify-center")}
						>
							<HelpCircle className="h-3.5 w-3.5" />
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>Dies sind spezielle Tags, die in Ihr Dokument eingefügt werden können.</p>
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
		</div>
	);
};

export default MenuBar;
