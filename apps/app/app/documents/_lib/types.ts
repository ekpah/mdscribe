import { z } from "zod";

const documentPdfTypeSchema = z.enum([
	"text",
	"multiline",
	"dropdown",
	"checkbox",
	"radio",
]);

const documentMarkdocTypeSchema = z.enum(["Info", "Switch"]);

const documentValueTypeSchema = z.enum(["string", "number", "date"]);

const documentFieldDefinitionSchema = z.object({
	description: z.string(),
	fieldName: z.string().min(1),
	isEnabled: z.boolean(),
	label: z.string(),
	markdocType: documentMarkdocTypeSchema,
	options: z.array(z.string()),
	pdfType: documentPdfTypeSchema,
	valueType: documentValueTypeSchema,
});

export const documentFieldDefinitionsSchema = z.array(documentFieldDefinitionSchema);

export type DocumentPdfType = z.infer<typeof documentPdfTypeSchema>;
export type DocumentFieldDefinition = z.infer<typeof documentFieldDefinitionSchema>;

const SWITCH_PDF_TYPES = new Set<DocumentPdfType>(["checkbox", "dropdown", "radio"]);

export const isSwitchPdfType = (pdfType: DocumentPdfType): boolean =>
	SWITCH_PDF_TYPES.has(pdfType);
