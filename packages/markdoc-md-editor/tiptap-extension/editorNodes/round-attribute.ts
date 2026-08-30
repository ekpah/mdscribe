export type RoundAttribute = number | false | null;

export const parseRoundAttribute = (element: Element): RoundAttribute => {
	const rawValue = element.getAttribute("round");
	if (rawValue === "false") {
		return false;
	}
	const value = rawValue === null || rawValue === "" ? Number.NaN : Number(rawValue);
	return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
};

export const renderRoundAttribute = (value: unknown): string | null => {
	if (value === false) {
		return "false";
	}
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
		? String(value)
		: null;
};

export const serializeRoundAttribute = (value: unknown): string => {
	const renderedValue = renderRoundAttribute(value);
	return renderedValue === null ? "" : ` round=${renderedValue}`;
};
