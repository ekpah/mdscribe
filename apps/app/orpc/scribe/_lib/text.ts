export const hasContent = (value: string | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

export const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

export const todaysDateDE = (): string =>
	new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
