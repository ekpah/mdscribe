import type {
	InfoInputTagType,
	InputTagType,
	SwitchInputTagType,
} from "../parse/parse-markdoc-to-inputs";
import { analyzeMarkdocTemplate } from "../parse/parse-markdoc-to-inputs";
import { evaluateFhirSource } from "./fhir";

const FHIR_SOURCE_PREFIX = "fhir://";

export type MarkdocSourceValue = boolean | number | string;

type MarkdocSourceDiagnosticCode =
	| "evaluation-error"
	| "invalid-source"
	| "invalid-template"
	| "missing-context"
	| "multiple-results"
	| "unsupported-result"
	| "unsupported-source";

export interface MarkdocSourceDiagnostic {
	code: MarkdocSourceDiagnosticCode;
	message: string;
	primary: string;
	source: string;
}

export interface MarkdocSourceContexts {
	fhir?: unknown;
}

export interface ResolvedMarkdocSources {
	diagnostics: MarkdocSourceDiagnostic[];
	values: Record<string, MarkdocSourceValue>;
}

export interface InspectedMarkdocSource {
	diagnostics: MarkdocSourceDiagnostic[];
	primary: string;
	results: unknown[];
	source: string;
	value?: MarkdocSourceValue;
}

export interface InspectedMarkdocSources extends ResolvedMarkdocSources {
	sources: InspectedMarkdocSource[];
}

type SourcedInputTag = InfoInputTagType | SwitchInputTagType;

const isPrimitiveSourceValue = (value: unknown): value is MarkdocSourceValue =>
	typeof value === "boolean" || typeof value === "number" || typeof value === "string";

const collectSourcedInputTags = (inputs: InputTagType[]): SourcedInputTag[] => {
	const sourcedTags: SourcedInputTag[] = [];
	const seen = new Set<string>();

	const visit = (input: InputTagType): void => {
		if ((input.name === "Info" || input.name === "Switch") && input.attributes.source) {
			const key = `${input.attributes.primary}\u0000${input.attributes.source}`;
			if (!seen.has(key)) {
				seen.add(key);
				sourcedTags.push(input);
			}
		}
		for (const child of input.children ?? []) {
			visit(child);
		}
	};

	for (const input of inputs) {
		visit(input);
	}
	return sourcedTags;
};

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unknown FHIRPath evaluation error";

const inspectFhirSource = (
	input: SourcedInputTag,
	contexts: MarkdocSourceContexts,
): InspectedMarkdocSource => {
	const { primary, source = "" } = input.attributes;
	const inspected: InspectedMarkdocSource = {
		diagnostics: [],
		primary,
		results: [],
		source,
	};
	const expression = source.slice(FHIR_SOURCE_PREFIX.length);
	if (!expression.trim()) {
		inspected.diagnostics.push({
			code: "invalid-source",
			message: "The fhir:// source does not contain a FHIRPath expression.",
			primary,
			source,
		});
		return inspected;
	}
	if (contexts.fhir === undefined) {
		inspected.diagnostics.push({
			code: "missing-context",
			message: "The fhir:// source requires a FHIR context.",
			primary,
			source,
		});
		return inspected;
	}

	try {
		inspected.results = evaluateFhirSource(contexts.fhir, expression);
	} catch (error) {
		inspected.diagnostics.push({
			code: "evaluation-error",
			message: `FHIRPath evaluation failed: ${toErrorMessage(error)}`,
			primary,
			source,
		});
		return inspected;
	}

	if (inspected.results.length === 0) {
		return inspected;
	}
	if (inspected.results.length > 1) {
		inspected.diagnostics.push({
			code: "multiple-results",
			message: `The FHIRPath expression returned ${inspected.results.length} values; exactly one is required.`,
			primary,
			source,
		});
		return inspected;
	}

	const [value] = inspected.results;
	if (!isPrimitiveSourceValue(value)) {
		inspected.diagnostics.push({
			code: "unsupported-result",
			message: "The FHIRPath expression must return a string, number, or boolean value.",
			primary,
			source,
		});
		return inspected;
	}
	inspected.value = value;
	return inspected;
};

/**
 * Evaluates supported Markdoc sources once and retains their raw FHIRPath results for tooling.
 * Renderer-safe primitive values remain available separately in `values`.
 */
export const inspectMarkdocSources = (
	markdocContent: string,
	contexts: MarkdocSourceContexts,
): InspectedMarkdocSources => {
	const diagnostics: MarkdocSourceDiagnostic[] = [];
	const resolvedEntries: [string, MarkdocSourceValue][] = [];
	const sources: InspectedMarkdocSource[] = [];
	const analysis = analyzeMarkdocTemplate(markdocContent);
	const conflictingPrimaries = new Set(
		analysis.diagnostics.map((diagnostic) => diagnostic.primary),
	);

	for (const input of collectSourcedInputTags(analysis.inputs)) {
		const { primary, source = "" } = input.attributes;
		if (conflictingPrimaries.has(primary)) {
			const diagnostic: MarkdocSourceDiagnostic = {
				code: "invalid-template",
				message: `The Markdoc contract for "${primary}" contains conflicting attributes.`,
				primary,
				source,
			};
			diagnostics.push(diagnostic);
			sources.push({ diagnostics: [diagnostic], primary, results: [], source });
			continue;
		}
		if (!source.startsWith(FHIR_SOURCE_PREFIX)) {
			const diagnostic: MarkdocSourceDiagnostic = {
				code: "unsupported-source",
				message: `Unsupported source scheme in "${source}".`,
				primary,
				source,
			};
			diagnostics.push(diagnostic);
			sources.push({ diagnostics: [diagnostic], primary, results: [], source });
			continue;
		}

		const inspected = inspectFhirSource(input, contexts);
		sources.push(inspected);
		diagnostics.push(...inspected.diagnostics);
		if (inspected.value !== undefined) {
			resolvedEntries.push([primary, inspected.value]);
		}
	}

	return {
		diagnostics,
		sources,
		values: Object.fromEntries(resolvedEntries),
	};
};

/** Resolves supported Markdoc `source` attributes into renderer variables. */
export const resolveMarkdocSources = (
	markdocContent: string,
	contexts: MarkdocSourceContexts,
): ResolvedMarkdocSources => {
	const { diagnostics, values } = inspectMarkdocSources(markdocContent, contexts);
	return { diagnostics, values };
};
