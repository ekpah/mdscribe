export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export const REASONING_EFFORT_OPTIONS: {
	description: string;
	label: string;
	value: ReasoningEffort;
}[] = [
	{ description: "Reasoning aus", label: "Aus", value: "none" },
	{ description: "ca. 10%", label: "Minimal", value: "minimal" },
	{ description: "ca. 20%", label: "Low", value: "low" },
	{ description: "ca. 50%", label: "Medium", value: "medium" },
	{ description: "ca. 80%", label: "High", value: "high" },
	{ description: "ca. 95%", label: "XHigh", value: "xhigh" },
];

export const supportsReasoningParameters = (
	model?: {
		supported_parameters?: string[];
		supportedParameters?: string[];
		supportsReasoning?: boolean;
	} | null,
): boolean =>
	Boolean(
		model?.supportsReasoning === true ||
		(model?.supported_parameters ?? []).includes("reasoning") ||
		(model?.supportedParameters ?? []).includes("reasoning"),
	);
