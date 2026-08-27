const CITE_TAG_PATTERN = /\{%\s*(\/?)cite\b[\s\S]*?%\}/giu;
const BLOCK_BOUNDARY_PATTERN = /\n[ \t]*\n|\n[ \t]*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|~~~)/u;

interface CiteToken {
	end: number;
	start: number;
}

const codeRanges = (content: string): CiteToken[] => {
	const fencedRanges: CiteToken[] = [];
	let fence: { character: string; length: number; start: number } | undefined;
	let lineStart = 0;
	while (lineStart < content.length) {
		const newline = content.indexOf("\n", lineStart);
		const lineEnd = newline === -1 ? content.length : newline + 1;
		const line = content.slice(lineStart, newline === -1 ? lineEnd : newline).replace(/\r$/u, "");
		if (!fence) {
			const opening = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
			if (opening) {
				fence = {
					character: opening[1][0],
					length: opening[1].length,
					start: lineStart,
				};
			}
		} else {
			const closing = /^ {0,3}(`+|~+)[ \t]*$/u.exec(line);
			if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
				fencedRanges.push({ end: lineEnd, start: fence.start });
				fence = undefined;
			}
		}
		lineStart = lineEnd;
	}
	if (fence) {
		fencedRanges.push({ end: content.length, start: fence.start });
	}

	const inlineRanges: CiteToken[] = [];
	const inlineOpenings = new Map<number, number>();
	let fenceIndex = 0;
	for (let index = 0; index < content.length; index++) {
		while (fencedRanges[fenceIndex]?.end <= index) {
			fenceIndex++;
		}
		const currentFence = fencedRanges[fenceIndex];
		if (currentFence && index >= currentFence.start) {
			inlineOpenings.clear();
			index = currentFence.end - 1;
			continue;
		}
		if (content[index] !== "`") {
			continue;
		}
		let runEnd = index + 1;
		while (content[runEnd] === "`") {
			runEnd++;
		}
		const length = runEnd - index;
		const opening = inlineOpenings.get(length);
		if (opening === undefined) {
			inlineOpenings.set(length, index);
		} else {
			inlineRanges.push({ end: runEnd, start: opening });
			inlineOpenings.delete(length);
		}
		index = runEnd - 1;
	}

	return [...fencedRanges, ...inlineRanges].sort((left, right) => left.start - right.start);
};

/**
 * Removes only structurally broken cite delimiters before tolerant rendering.
 * The visible body is preserved; editor and mutation boundaries still report
 * the original Markdoc diagnostics.
 */
export const sanitizeMarkdocForRendering = (content: string): string => {
	const stack: CiteToken[] = [];
	const remove = new Set<CiteToken>();
	const protectedRanges = codeRanges(content);
	let protectedIndex = 0;
	for (const match of content.matchAll(CITE_TAG_PATTERN)) {
		const start = match.index;
		while (protectedRanges[protectedIndex]?.end <= start) {
			protectedIndex++;
		}
		const protectedRange = protectedRanges[protectedIndex];
		if (protectedRange && start >= protectedRange.start) {
			continue;
		}
		const token = { end: start + match[0].length, start };
		const isClosing = match[1] === "/";
		const isSelfClosing = /\/%\}\s*$/u.test(match[0]);
		if (isSelfClosing || (isClosing && stack.length === 0)) {
			remove.add(token);
			continue;
		}
		if (!isClosing) {
			stack.push(token);
			continue;
		}

		const opening = stack.pop();
		if (!opening) {
			remove.add(token);
			continue;
		}
		if (BLOCK_BOUNDARY_PATTERN.test(content.slice(opening.end, token.start))) {
			remove.add(opening);
			remove.add(token);
		}
	}
	for (const opening of stack) {
		remove.add(opening);
	}
	if (remove.size === 0) {
		return content;
	}

	const tokens = [...remove].sort((left, right) => right.start - left.start);
	let sanitized = content;
	for (const token of tokens) {
		sanitized = sanitized.slice(0, token.start) + sanitized.slice(token.end);
	}
	return sanitized;
};
