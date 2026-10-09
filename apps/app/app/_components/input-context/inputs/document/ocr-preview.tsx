import { parseDocument } from "htmlparser2";
import { marked } from "marked";
import { createElement } from "react";
import type { ReactNode } from "react";

import type { OcrPage } from "@/lib/ocr-types";

const tags = new Set([
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"th",
	"td",
	"caption",
	"br",
	"p",
	"strong",
	"b",
	"em",
	"i",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"code",
	"del",
	"hr",
	"sub",
	"sup",
]);
// Tags that are unwrapped to their children rather than rendered.
const unwrappedTags = ["html", "body", "div", "span"];
// OCR text such as "<NWG" or "<5 mm" is content, not markup: escape every "<"
// that does not start a known tag so the parser cannot swallow following text.
const strayLessThan = new RegExp(`<(?!/?(?:${[...tags, ...unwrappedTags].join("|")})\\b)`, "gi");
type ParsedNode = ReturnType<typeof parseDocument>["children"][number];

const renderNode = (node: ParsedNode, key: number): ReactNode => {
	if (node.type === "text") {
		return node.data;
	}
	if (node.type !== "tag") {
		return null;
	}
	const directRows =
		node.name === "table"
			? node.children.filter((child) => child.type === "tag" && child.name === "tr")
			: [];
	const children = node.children
		.filter((child) => !directRows.includes(child))
		.filter(
			(child) =>
				!(
					child.type === "text" &&
					!child.data.trim() &&
					["table", "thead", "tbody", "tfoot", "tr", "ul", "ol", "blockquote"].includes(node.name)
				),
		)
		.map(renderNode);
	if (directRows.length) {
		children.push(createElement("tbody", { key: "rows" }, directRows.map(renderNode)));
	}
	if (unwrappedTags.includes(node.name) || node.name === "a") {
		return children;
	}
	// GFM task lists become checkboxes. Keep selection as inert source markers,
	// not form controls; dropping the input would lose medically relevant state.
	if (node.name === "input" && node.attribs.type === "checkbox") {
		return Object.hasOwn(node.attribs, "checked") ? "[x]" : "[ ]";
	}
	if (!tags.has(node.name)) {
		return null;
	}
	// Rebuild a small inert subset as React elements. No source attributes, URLs,
	// CSS, handlers, or executable HTML are ever passed through.
	const span = (name: string) => {
		const value = Number(node.attribs[name]);
		return Number.isInteger(value) && value > 0 && value <= 1000 ? value : undefined;
	};
	const props =
		node.name === "td" || node.name === "th"
			? { colSpan: span("colspan"), key, rowSpan: span("rowspan") }
			: { key };
	return createElement(node.name, props, ["br", "hr"].includes(node.name) ? undefined : children);
};

export const OcrTextPreview = ({ text }: { text: string }) => (
	<div className="prose prose-sm max-w-none whitespace-pre-wrap [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:whitespace-normal [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2">
		{/* Markdown and source HTML share the same inert React allowlist. Escape
		    unknown source tags first, preserving lab thresholds and template text.
		    Markdown-generated links are unwrapped; images are discarded. */}
		{parseDocument(
			marked.parse(text.replaceAll(strayLessThan, "&lt;"), {
				async: false,
				breaks: true,
				gfm: true,
			}),
		)
			.children.filter((node) => node.type !== "text" || node.data.trim())
			.map(renderNode)}
	</div>
);

export type QuarterTurn = 0 | 90 | 180 | 270;

/** SVG transform that turns a w×h box clockwise and moves it back into view. */
const turnTransform = (width: number, height: number, turn: QuarterTurn) =>
	({
		0: undefined,
		180: `translate(${width} ${height}) rotate(180)`,
		270: `translate(0 ${width}) rotate(270)`,
		90: `translate(${height} 0) rotate(90)`,
	})[turn];

const isSideways = (turn: QuarterTurn) => turn === 90 || turn === 270;

/**
 * Shows an image in its OCR page frame with optional citation boxes, turned
 * clockwise by `viewRotation`. Boxes and image are turned together, so they stay
 * aligned. No automatic engine correction is applied.
 */
export const OcrImagePreview = ({
	alt,
	page,
	previewUrl,
	showRegions,
	viewRotation,
}: {
	alt: string;
	page: Pick<OcrPage, "blocks" | "height" | "width">;
	previewUrl: string;
	showRegions: boolean;
	viewRotation: QuarterTurn;
}) => {
	const viewWidth = isSideways(viewRotation) ? page.height : page.width;
	const viewHeight = isSideways(viewRotation) ? page.width : page.height;
	return (
		<svg className="h-full w-full" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
			<title>{alt}</title>
			<g transform={turnTransform(page.width, page.height, viewRotation)}>
				<image height={page.height} href={previewUrl} width={page.width} />
				{showRegions
					? page.blocks.map(({ bbox, text }, index) => (
							<rect
								className="fill-blue-500/10 stroke-blue-600 hover:fill-blue-500/30"
								height={bbox.height}
								key={`${index}-${bbox.x}-${bbox.y}`}
								strokeWidth={1.5}
								vectorEffect="non-scaling-stroke"
								width={bbox.width}
								x={bbox.x}
								y={bbox.y}
							>
								<title>{text}</title>
							</rect>
						))
					: null}
			</g>
		</svg>
	);
};
