import { placeCaretAfterInsertedInlineTag } from "@repo/design-system/components/editor/_lib/place-caret-after-inserted-inline-tag";
import { Button } from "@repo/design-system/components/ui/button";
import type { Editor } from "@tiptap/react";
import { Code, HelpCircle, List, Redo, Undo } from "lucide-react";
import { useCallback } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../../ui/tooltip";

const MenuBar = ({
	editor,
	showSource: _showSource,
	onToggleSource,
}: {
	editor: Editor | null;
	showSource?: boolean;
	onToggleSource?: () => void;
}) => {
	if (!editor) {
		return null;
	}

	const handleToggleBold = useCallback(() => {
		editor.chain().focus().toggleBold().run();
	}, [editor]);

	const handleToggleItalic = useCallback(() => {
		editor.chain().focus().toggleItalic().run();
	}, [editor]);

	const handleToggleH1 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 1 }).run();
	}, [editor]);

	const handleToggleH2 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 2 }).run();
	}, [editor]);

	const handleToggleH3 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 3 }).run();
	}, [editor]);

	const handleToggleBulletList = useCallback(() => {
		editor.chain().focus().toggleBulletList().run();
	}, [editor]);

	const handleUndo = useCallback(() => {
		editor.chain().focus().undo().run();
	}, [editor]);

	const handleRedo = useCallback(() => {
		editor.chain().focus().redo().run();
	}, [editor]);

	const handleInsertInfoTag = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertContent({
				attrs: {
					primary: "...",
				},
				type: "infoTag",
			})
			.command(placeCaretAfterInsertedInlineTag)
			.run();
	}, [editor]);

	const handleInsertSwitchTag = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertContent({
				attrs: {
					cases: [{ primary: "", text: "..." }],
					primary: "...",
				},
				type: "switchTag",
			})
			.command(placeCaretAfterInsertedInlineTag)
			.run();
	}, [editor]);

	const handleInsertScoreTag = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertContent({
				attrs: {
					formula: "",
					unit: "",
				},
				type: "scoreTag",
			})
			.command(placeCaretAfterInsertedInlineTag)
			.run();
	}, [editor]);

	return (
		<div className="mb-2 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-muted/90 p-2">
			<div className="flex flex-wrap gap-1">
					<Button
						className={`h-8 px-2 ${editor.isActive("bold") ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						disabled={!editor.can().chain().focus().toggleBold().run()}
						onClick={handleToggleBold}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="font-bold">B</span>
				</Button>
					<Button
						className={`h-8 px-2 ${editor.isActive("italic") ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						disabled={!editor.can().chain().focus().toggleItalic().run()}
						onClick={handleToggleItalic}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="italic">I</span>
				</Button>

				<div className="mx-1 h-8 w-px bg-border" />

					<Button
						className={`h-8 px-2 ${editor.isActive("heading", { level: 1 }) ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						onClick={handleToggleH1}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="font-bold text-base">H1</span>
				</Button>
					<Button
						className={`h-8 px-2 ${editor.isActive("heading", { level: 2 }) ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						onClick={handleToggleH2}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="font-bold text-sm">H2</span>
				</Button>
					<Button
						className={`h-8 px-2 ${editor.isActive("heading", { level: 3 }) ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						onClick={handleToggleH3}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="font-bold text-xs">H3</span>
				</Button>

				<div className="mx-1 h-8 w-px bg-border" />

					<Button
						className={`h-8 px-2 ${editor.isActive("bulletList") ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						onClick={handleToggleBulletList}
					size="sm"
					type="button"
					variant="ghost"
				>
					<List className="h-4 w-4" />
				</Button>

				<div className="mx-1 h-8 w-px bg-border" />
					<Button
						className={`h-8 px-2 ${editor.isActive("undo") ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						disabled={!editor.can().chain().focus().undo().run()}
						onClick={handleUndo}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Undo className="h-4 w-4" />
				</Button>
					<Button
						className={`h-8 px-2 ${editor.isActive("redo") ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"}`}
						disabled={!editor.can().chain().focus().redo().run()}
						onClick={handleRedo}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Redo className="h-4 w-4" />
				</Button>
				<div className="mx-1 h-8 w-px bg-border" />

					<Button
						className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-blue px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-blue/90"
						onClick={handleInsertInfoTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Info</span>
				</Button>
					<Button
						className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-green px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-green/90"
						onClick={handleInsertSwitchTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Switch</span>
				</Button>

					<Button
						className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-orange px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-orange/90"
						onClick={handleInsertScoreTag}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span>Score</span>
				</Button>

				<TooltipProvider>
					<Tooltip delayDuration={200}>
						<TooltipTrigger className="h-8 bg-transparent px-2 hover:bg-muted">
							<HelpCircle className="h-4 w-4" />
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>
								Dies sind spezielle Tags, die in Ihr Dokument eingefügt werden
								können.
							</p>
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
						className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
						onClick={onToggleSource}
						type="button"
					>
						<Code className="h-4 w-4" />
						<span className="hidden sm:inline">Quelltext anzeigen</span>
					</button>
				</div>
			)}
		</div>
	);
};

export default MenuBar;
