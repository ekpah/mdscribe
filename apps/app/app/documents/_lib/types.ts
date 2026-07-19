import { z } from "zod";

const MAX_DOCUMENT_INPUTS = 2000;
const MAX_DOCUMENT_BINDINGS = 5000;
const MAX_DOCUMENT_OPTIONS = 500;
const MAX_DOCUMENT_IDENTIFIER_LENGTH = 500;
const MAX_DOCUMENT_DESCRIPTION_LENGTH = 4000;

export const documentPdfTypeSchema = z.enum([
	"text",
	"multiline",
	"dropdown",
	"checkbox",
	"radio",
	"unsupported",
]);

const documentCaseInputSchema = z
	.object({
		$$mdtype: z.literal("Tag").optional(),
		attributes: z.object({ primary: z.string().min(1).max(MAX_DOCUMENT_IDENTIFIER_LENGTH) }),
		children: z.array(z.never()),
		name: z.literal("Case"),
	})
	.strict();

const documentInfoInputSchema = z
	.object({
		$$mdtype: z.literal("Tag").optional(),
		attributes: z.object({
			description: z.string().max(MAX_DOCUMENT_DESCRIPTION_LENGTH).optional(),
			primary: z.string().min(1).max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
			renderUnit: z.boolean().optional(),
			type: z.enum(["string", "number", "date"]).optional(),
			unit: z.string().max(MAX_DOCUMENT_IDENTIFIER_LENGTH).optional(),
		}),
		children: z.array(z.never()).max(0),
		name: z.literal("Info"),
	})
	.strict();

const documentSwitchInputSchema = z
	.object({
		$$mdtype: z.literal("Tag").optional(),
		attributes: z.object({
			primary: z.string().min(1).max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
			type: z.enum(["string", "boolean", "checkbox"]).optional(),
		}),
		children: z.array(documentCaseInputSchema).max(MAX_DOCUMENT_OPTIONS),
		name: z.literal("Switch"),
	})
	.strict();

export const documentInputSchema = z.discriminatedUnion("name", [
	documentInfoInputSchema,
	documentSwitchInputSchema,
]);

export const documentBindingSchema = z
	.object({
		fieldName: z.string().min(1).max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
		inputId: z.string().min(1).max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
		isEnabled: z.boolean().default(true),
		valueMap: z
			.record(
				z.string().max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
				z.string().max(MAX_DOCUMENT_IDENTIFIER_LENGTH),
			)
			.refine((valueMap) => Object.keys(valueMap).length <= MAX_DOCUMENT_OPTIONS, {
				message: `PDF-Wertzuordnungen dürfen höchstens ${MAX_DOCUMENT_OPTIONS} Einträge enthalten.`,
			})
			.optional(),
	})
	.strict();

export const documentDefinitionSchema = z
	.object({
		bindings: z.array(documentBindingSchema).max(MAX_DOCUMENT_BINDINGS),
		inputs: z.array(documentInputSchema).max(MAX_DOCUMENT_INPUTS),
	})
	.strict();

export type DocumentPdfType = z.infer<typeof documentPdfTypeSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentBinding = z.infer<typeof documentBindingSchema>;
export type DocumentDefinition = z.infer<typeof documentDefinitionSchema>;

// Semantic classification assigned to parsed PDF fields and editor rows.
export type DocumentInputKind = "boolean" | "choice" | "text";
