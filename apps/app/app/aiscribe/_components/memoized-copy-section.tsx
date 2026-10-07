"use client";

import { Check, Copy } from "lucide-react";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import { memo, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { getRenderedClipboardContent } from "@/lib/rendered-clipboard";

interface MemoizedCopySectionProps {
	title?: string;
	content: string;
	values?: Record<string, unknown>;
}

export const MemoizedCopySection = memo(({ title, content, values }: MemoizedCopySectionProps) => {
	const [isCopied, setIsCopied] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	const handleCopy = useCallback(async (renderedContent: string, textContent: string) => {
		try {
			if (!navigator.clipboard) {
				throw new Error("Clipboard API not supported");
			}

			// Both formats come from the same rendered document, with explicit line
			// blocks and breaks rather than clipboard-only newline rewriting.
			if (
				typeof ClipboardItem !== "undefined" &&
				typeof navigator.clipboard.write === "function" &&
				renderedContent
			) {
				try {
					const clipboardItem = new ClipboardItem({
						"text/html": new Blob([renderedContent], { type: "text/html" }),
						"text/plain": new Blob([textContent], { type: "text/plain" }),
					});
					await navigator.clipboard.write([clipboardItem]);
					setIsCopied(true);
					toast.success("Text kopiert (Rich-Text Format)");
					return;
				} catch (htmlError) {
					console.warn("HTML clipboard failed, trying plain text:", htmlError);
				}
			}

			await navigator.clipboard.writeText(textContent);
			setIsCopied(true);
			toast.success("Text kopiert (Einfacher Text)");
		} catch (error) {
			console.error("Clipboard operation failed:", error);
			try {
				const textArea = document.createElement("textarea");
				textArea.value = textContent;
				textArea.style.position = "fixed";
				textArea.style.opacity = "0";
				document.body.append(textArea);
				textArea.select();
				const success = document.execCommand("copy");
				textArea.remove();

				if (!success) {
					throw new Error("Legacy copy failed", { cause: error });
				}
				setIsCopied(true);
				toast.success("Text kopiert (Fallback)");
			} catch (legacyError) {
				toast.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
				console.error("All clipboard methods failed:", legacyError);
			}
		} finally {
			setTimeout(() => setIsCopied(false), 2000);
		}
	}, []);

	const handleCopyClick = useCallback(async () => {
		if (!contentRef.current) {
			toast.error("Problem mit dem Kopieren - bitte manuell kopieren");
			return;
		}
		const { html, text } = getRenderedClipboardContent(contentRef.current);
		await handleCopy(html, text);
	}, [handleCopy]);

	return (
		<div className="space-y-2">
			{title && <h3 className="font-medium text-lg capitalize">{title}</h3>}
			<div className="group relative w-full rounded-md bg-muted p-3 text-left">
				<div ref={contentRef} data-section={title}>
					<DynamicMarkdocRenderer layout="template" markdocContent={content} variables={values} />
				</div>
				<button
					aria-label="Gerenderten Text kopieren"
					type="button"
					onClick={handleCopyClick}
					className="absolute top-2 right-2 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
				>
					{isCopied ? (
						<Check className="h-4 w-4 text-solarized-green" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
		</div>
	);
});

MemoizedCopySection.displayName = "MemoizedCopySection";
