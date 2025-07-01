"use client";
import Markdoc from "@markdoc/markdoc";
import { DynamicMarkdocRenderer } from "@repo/markdoc-md";
import { Check, Copy } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

interface MemoizedCopySectionProps {
	title?: string;
	content: string;
	values?: Record<string, unknown>;
}

function parseMarkdocIntoBlocks(markdown: string): string[] {
	// Parse with Markdoc to validate syntax, but use line-by-line for block extraction
	try {
		Markdoc.parse(markdown); // This validates the Markdoc syntax
	} catch (error) {
		console.warn(
			"Markdoc parsing error, falling back to basic parsing:",
			error,
		);
	}

	const blocks: string[] = [];
	const lines = markdown.split("\n");
	let currentBlock = "";
	let inMarkdocTag = false;
	let tagDepth = 0;

	for (const line of lines) {
		const trimmedLine = line.trim();

		// Check for Markdoc opening tags (not self-closing)
		const openTagMatches = trimmedLine.match(/\{%\s*([^/\s]+)/g);
		// Check for Markdoc closing tags
		const closeTagMatches = trimmedLine.match(/\{%\s*\/([^/\s]+)/g);
		// Check for self-closing tags
		const selfClosingMatches = trimmedLine.match(/\{%.*\/%\}/g);

		if (openTagMatches && !selfClosingMatches) {
			if (!inMarkdocTag && currentBlock.trim()) {
				blocks.push(currentBlock.trim());
				currentBlock = "";
			}
			inMarkdocTag = true;
			tagDepth += openTagMatches.length;
		}

		if (closeTagMatches) {
			tagDepth -= closeTagMatches.length;
			if (tagDepth <= 0) {
				inMarkdocTag = false;
				tagDepth = 0;
				// Add the line to complete the tag block
				currentBlock = currentBlock ? `${currentBlock}\n${line}` : line;
				blocks.push(currentBlock.trim());
				currentBlock = "";
				continue;
			}
		}

		currentBlock = currentBlock ? `${currentBlock}\n${line}` : line;

		// Natural break points when not in tags
		if (
			!inMarkdocTag &&
			currentBlock.trim() &&
			(trimmedLine.match(/^#{1,6}\s/) ||
				trimmedLine.match(/^[-*_]{3,}$/) ||
				(trimmedLine === "" && currentBlock.trim()))
		) {
			blocks.push(currentBlock.trim());
			currentBlock = "";
		}
	}

	if (currentBlock.trim()) {
		blocks.push(currentBlock.trim());
	}

	return blocks.filter((block) => block.length > 0);
}

const MemoizedMarkdownBlock = memo(
	({
		content,
		values,
	}: {
		content: string;
		values?: Record<string, unknown>;
	}) => {
		return (
			<DynamicMarkdocRenderer variables={values} markdocContent={content} />
		);
	},
	(prevProps, nextProps) => {
		if (prevProps.content !== nextProps.content) return false;
		if (JSON.stringify(prevProps.values) !== JSON.stringify(nextProps.values))
			return false;
		return true;
	},
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedCopySection = memo(
	({ title, content, values }: MemoizedCopySectionProps) => {
		const [isCopied, setIsCopied] = useState(false);
		const blocks = useMemo(() => parseMarkdocIntoBlocks(content), [content]);
		const contentRef = useRef<HTMLDivElement>(null);

		const handleCopy = async (renderedContent: string, textContent: string) => {
			try {
				// Check if we're in a secure context and have clipboard support
				if (!navigator.clipboard) {
					throw new Error("Clipboard API not supported");
				}

				// Try modern approach first (for newer browsers)
				if (typeof ClipboardItem !== "undefined" && ClipboardItem.supports) {
					// Use ClipboardItem.supports() to check HTML support (Chrome 133+)
					if (ClipboardItem.supports("text/html")) {
						const clipboardItem = new ClipboardItem({
							"text/html": new Blob([renderedContent || ""], {
								type: "text/html",
							}),
							"text/plain": new Blob([textContent || ""], {
								type: "text/plain",
							}),
						});
						await navigator.clipboard.write([clipboardItem]);
						setIsCopied(true);
						toast.success("Text kopiert (Rich-Text Format)");
						return;
					}
				}

				// Fallback approach for browsers with partial ClipboardItem support
				// Try HTML-only ClipboardItem first
				if (typeof ClipboardItem !== "undefined" && renderedContent) {
					try {
						const clipboardItem = new ClipboardItem({
							"text/html": new Blob([renderedContent], {
								type: "text/html",
							}),
						});
						await navigator.clipboard.write([clipboardItem]);
						setIsCopied(true);
						toast.success("Text kopiert (Rich-Text Format)");
						return;
					} catch (htmlError) {
						console.warn(
							"HTML clipboard failed, trying plain text:",
							htmlError,
						);
					}
				}

				// Final fallback to plain text (most compatible)
				await navigator.clipboard.writeText(
					textContent || renderedContent || "",
				);
				setIsCopied(true);
				toast.success("Text kopiert (Einfacher Text)");
			} catch (error) {
				console.error("Clipboard operation failed:", error);

				// Legacy fallback using document.execCommand (for very old browsers)
				try {
					const textArea = document.createElement("textarea");
					textArea.value = textContent || renderedContent || "";
					textArea.style.position = "fixed";
					textArea.style.opacity = "0";
					document.body.appendChild(textArea);
					textArea.select();
					const success = document.execCommand("copy");
					document.body.removeChild(textArea);

					if (success) {
						setIsCopied(true);
						toast.success("Text kopiert (Fallback)");
					} else {
						throw new Error("Legacy copy failed");
					}
				} catch (legacyError) {
					toast.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
					console.error("All clipboard methods failed:", legacyError);
				}
			} finally {
				setTimeout(() => setIsCopied(false), 2000);
			}
		};

		return (
			<div className="space-y-2">
				{title && <h3 className="font-medium text-lg capitalize">{title}</h3>}
				<div className="group relative w-full whitespace-pre-line rounded-md bg-muted p-3 text-left">
					<div ref={contentRef} data-section={title}>
						{blocks.map((block, index) => (
							<MemoizedMarkdownBlock
								content={block}
								values={values}
								key={`block_${index}`}
							/>
						))}
					</div>
					<button
						type="button"
						tabIndex={0}
						onClick={() => {
							// Use the ref to get the rendered content directly
							const contentElement = contentRef.current;
							if (contentElement) {
								const renderedContent = contentElement.innerHTML;
								const textContent =
									contentElement.innerText || contentElement.textContent || "";
								handleCopy(renderedContent, textContent);
							} else {
								toast.error(
									"Problem mit dem Kopieren - bitte manuell kopieren",
								);
							}
						}}
						className="absolute top-2 right-2 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
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
	},
);

MemoizedCopySection.displayName = "MemoizedCopySection";
