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

type ReasoningSupportStatus = "supported" | "unsupported" | "unknown";

export const getReasoningSupportStatus = (
	model?: {
		supported_parameters?: string[];
		supportedParameters?: string[];
		supportsReasoning?: boolean;
	} | null,
): ReasoningSupportStatus => {
	if (!model) {
		return "unknown";
	}
	const supportedParameters = model.supported_parameters ?? model.supportedParameters ?? [];
	if (
		model.supportsReasoning === true ||
		supportedParameters.includes("reasoning") ||
		supportedParameters.includes("include_reasoning")
	) {
		return "supported";
	}
	return supportedParameters.length > 0 ? "unsupported" : "unknown";
};

export const supportsReasoningParameters = (
	model?: {
		supported_parameters?: string[];
		supportedParameters?: string[];
		supportsReasoning?: boolean;
	} | null,
): boolean =>
	Boolean(model && getReasoningSupportStatus(model) !== "unsupported");
