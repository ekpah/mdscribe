/** Cell content is already serialized Markdoc, not untrusted HTML. */
export interface MarkdocTableCell {
	content: string;
	colspan?: number;
	rowspan?: number;
}

/** Native list tables preserve merged cells without expanding their contents. */
export const serializeMarkdocTable = (
	rows: readonly (readonly MarkdocTableCell[])[],
	hasHeader: boolean,
): string => {
	const content = rows
		.map((row) =>
			row
				.map((cell) => {
					let source = cell.content.trimEnd();
					const spans = (["colspan", "rowspan"] as const).flatMap((name) => {
						const value = cell[name];
						return value !== undefined && value > 1 ? [`${name}=${value}`] : [];
					});
					if (spans.length > 0) {
						source += `{% ${spans.join(" ")} %}`;
					}
					const lines = source.split("\n");
					return `* ${lines[0]}${lines
						.slice(1)
						.map((line) => `\n  ${line}`)
						.join("")}`;
				})
				.join("\n"),
		)
		.join("\n---\n");
	return `{% table %}\n${hasHeader ? "" : "---\n"}${content}\n{% /table %}\n\n`;
};
