/* Use this file to export your Markdoc functions */

export const includes = {
	transform(parameters: Record<string, unknown>) {
		const [array, value] = Object.values(parameters);
		return Array.isArray(array) ? array.includes(value) : false;
	},
};

export const upper = {
	transform(parameters: Record<string, unknown>) {
		const [value] = Object.values(parameters);
		return typeof value === "string" ? value.toUpperCase() : value;
	},
};
