import { z } from "zod";

const documentPdfTypeSchema = z.enum(["text", "multiline", "dropdown", "checkbox", "radio"]);

const documentMarkdocTypeSchema = z.enum(["Info", "Switch"]);

const documentValueTypeSchema = z.enum(["string", "number", "date"]);

const documentInputKindSchema = z.enum(["boolean", "choice", "text"]);

const documentFieldDefinitionSchema = z.object({
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

export type DocumentPdfType = z.infer<typeof documentPdfTypeSchema>;
export type DocumentInputKind = z.infer<typeof documentInputKindSchema>;
export type DocumentFieldDefinition = z.infer<typeof documentFieldDefinitionSchema>;
