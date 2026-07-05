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

// Legacy, array-shaped definition persisted by documents created before v2.
// Keep this only at the compatibility boundary; new documents store DocumentDefinition.
export const documentInputKindSchema = z.enum(["boolean", "choice", "text"]);
export const documentValueTypeSchema = z.enum(["string", "number", "date"]);
export const documentMarkdocTypeSchema = z.enum(["Info", "Switch"]);

export const documentFieldDefinitionSchema = z.object({
	description: z.string(),
	fieldName: z.string().min(1),
	inputKind: documentInputKindSchema,
	isEnabled: z.boolean(),
	label: z.string(),
	markdocType: documentMarkdocTypeSchema,
	maxLength: z.number().int().positive().optional(),
	options: z.array(z.string()),
	pdfType: documentPdfTypeSchema,
	textCheckboxValue: z.string().optional(),
	valueType: documentValueTypeSchema,
});

export type DocumentInputKind = z.infer<typeof documentInputKindSchema>;
export type DocumentFieldDefinition = z.infer<typeof documentFieldDefinitionSchema>;
