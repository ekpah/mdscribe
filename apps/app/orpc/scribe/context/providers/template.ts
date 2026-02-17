import type { ContextProvider } from "../types";

/**
 * Reserved for institution/user templates and style examples.
 * Intentionally returns null until template sources are fully integrated.
 */
export const templateContextProvider: ContextProvider = {
	id: "template",
	build: () => null,
};
