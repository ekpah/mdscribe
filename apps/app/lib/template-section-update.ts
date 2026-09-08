import { z } from "zod";

export const templateSectionUpdateSchema = z
	.object({
		content: z
			.string()
			.max(100_000)
			.optional()
			.describe("Vollständiger Markdoc-Inhalt, ohne Codeblock."),
		examples: z
			.array(z.string())
			.max(10)
			.optional()
			.describe("Alle gewünschten Beispieltexte; [] zum Leeren."),
		information: z
			.string()
			.max(10_000)
			.optional()
			.describe("Vollständige Hinweise; leerer String zum Leeren."),
	})
	.refine((value) => Object.values(value).some((section) => section !== undefined), {
		message: "Mindestens ein Abschnitt ist erforderlich.",
	});
