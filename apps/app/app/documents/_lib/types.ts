import { z } from "zod";

import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

export const documentPdfTypeSchema = z.enum([
	"text",
	"multiline",
	"dropdown",
	"checkbox",
	"radio",
]);

export const documentFieldMappingSchema = z.object({
	condition: z.string().optional(),
	fieldName: z.string().min(1),
	isEnabled: z.boolean().default(true),
	pdfType: documentPdfTypeSchema,
	value: z.string().optional(),
	variable: z.string().min(1),
});

export type DocumentPdfType = z.infer<typeof documentPdfTypeSchema>;
export type DocumentFieldMapping = z.infer<typeof documentFieldMappingSchema>;

export interface DocumentDefinition {
	fieldMappings: DocumentFieldMapping[];
	inputTags: InputTagType[];
	version: 2;
}

// Semantic classification assigned to parsed PDF fields and playground editors;
// not persisted — stored definitions describe inputs via inputTags.
export type DocumentInputKind = "boolean" | "choice" | "text";
