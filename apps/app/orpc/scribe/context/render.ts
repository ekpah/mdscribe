import type { ContextBlock } from "./types";

export function renderContextXml(blocks: ContextBlock[]): string {
	if (!blocks.length) return "";
	return blocks
		.map((block) => `<${block.tag}>\n${block.content}\n</${block.tag}>`)
		.join("\n\n");
}
