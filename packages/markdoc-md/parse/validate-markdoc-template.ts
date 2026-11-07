import type { Config, Location, Node } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { readCiteCitations } from "../citations/cite-attributes";
import { MAX_CITATION_QUOTE_LENGTH } from "../citations/resolvers/types";
import { markdocConfig } from "../markdoc-config";
import {
	type MarkdocTagDiagnostic,
	validateMarkdocTagContractsInAst,
} from "./validate-markdoc-tag-contracts";

export type MarkdocTemplateDiagnostic =
	| MarkdocTagDiagnostic
	| {
			code: "markdoc-schema";
			id: string;
			location?: Location;
			message: string;
			severity: "error" | "warning";
	  }
	| {
			code: "citation-source-invalid";
			location?: Location;
			message: string;
			severity: "error";
			source: string;
	  }
	| {
			code: "citation-malformed";
			location?: Location;
			message: string;
			severity: "error";
	  }
	| {
			code: "citation-quote-too-long";
			location?: Location;
			message: string;
			severity: "error";
	  };

const isCiteTag = (node: Node): boolean => node.type === "tag" && node.tag === "cite";

/**
 * Performs the complete validation required at editor and mutation boundaries.
 * Rendering remains tolerant so existing stored templates can still be displayed.
 */
export const validateMarkdocTemplate = (
	content: string,
	config: Config = markdocConfig,
): MarkdocTemplateDiagnostic[] => validateMarkdocTemplateAst(Markdoc.parse(content), config);

/** Internal AST-based path used when a caller already parsed the template. */
export const validateMarkdocTemplateAst = (
	ast: Node,
	config: Config = markdocConfig,
): MarkdocTemplateDiagnostic[] => {
	const diagnostics: MarkdocTemplateDiagnostic[] = Markdoc.validate(ast, config).map(
		(diagnostic) => ({
			code: "markdoc-schema" as const,
			id: diagnostic.error.id,
			location: diagnostic.lines
				? {
						file: undefined,
						start: { line: diagnostic.lines[0] },
						end: { line: diagnostic.lines[1] },
					}
				: undefined,
			message: diagnostic.error.message,
			severity: diagnostic.error.level === "warning" ? ("warning" as const) : ("error" as const),
		}),
	);

	diagnostics.push(...validateMarkdocTagContractsInAst(ast));
	for (const node of ast.walk()) {
		if (!isCiteTag(node)) {
			continue;
		}
		for (const problem of readCiteCitations(node.attributes).problems) {
			if (problem.kind === "source-invalid") {
				diagnostics.push({
					code: "citation-source-invalid",
					location: node.location,
					message: `Invalid citation source: "${problem.source}".`,
					severity: "error",
					source: problem.source,
				});
			} else if (problem.kind === "quote-too-long") {
				diagnostics.push({
					code: "citation-quote-too-long",
					location: node.location,
					message: `Citation quotes may contain at most ${MAX_CITATION_QUOTE_LENGTH} characters.`,
					severity: "error",
				});
			} else {
				diagnostics.push({
					code: "citation-malformed",
					location: node.location,
					message:
						"A citation needs either source/quote or a citations list of { source, quote } entries.",
					severity: "error",
				});
			}
		}
	}

	return diagnostics;
};
