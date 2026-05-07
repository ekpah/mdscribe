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
	options: z.array(z.string()),
	pdfType: documentPdfTypeSchema,
	valueType: documentValueTypeSchema,
});

export const documentFieldDefinitionsSchema = z.array(documentFieldDefinitionSchema);

export type DocumentPdfType = z.infer<typeof documentPdfTypeSchema>;
export type DocumentInputKind = z.infer<typeof documentInputKindSchema>;
export type DocumentFieldDefinition = z.infer<typeof documentFieldDefinitionSchema>;
