import type { ContextProvider } from "../types";

const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

export const userContextProvider: ContextProvider = {
	build: ({ sessionUser }) => {
		const name = toTrimmedString(sessionUser?.name);
		if (!name) {return null;}

		return {
			content: `<name>${name}</name>`,
			tag: "user_context",
		};
	},
	id: "user",
};
