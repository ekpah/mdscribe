import type { ContextProvider } from "../types";

const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

export const userContextProvider: ContextProvider = {
	id: "user",
	build: ({ sessionUser }) => {
		const name = toTrimmedString(sessionUser?.name);
		if (!name) return null;

		return {
			tag: "user_context",
			content: `<name>${name}</name>`,
		};
	},
};
