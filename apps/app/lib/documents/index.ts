export {
	buildParsedMarkdocFromFieldDefinitions,
} from "@/lib/documents/build-parsed-markdoc-from-field-definitions";
export { fillPDFForm } from "@/lib/documents/fill-pdf-form";
export {
	decodeBase64ToUint8Array,
	downloadPdfBlob,
	encodeUint8ArrayToBase64,
	MAX_PDF_UPLOAD_BYTES,
	printPdfBlob,
	toPdfBlob,
	toPdfBlobUrl,
} from "@/lib/documents/pdf-data";
export {
	buildDefaultFieldDefinitionsFromPdfFields,
	parsePDFFormFields,
} from "@/lib/documents/parse-pdf-form-fields";
export type { PDFField } from "@/lib/documents/parse-pdf-form-fields";
export type {
	DocumentFieldDefinition,
	DocumentMarkdocType,
	DocumentPdfType,
	DocumentValueType,
} from "@/lib/documents/types";
export {
	documentFieldDefinitionSchema,
	documentFieldDefinitionsSchema,
	documentMarkdocTypeSchema,
	documentPdfTypeSchema,
	documentValueTypeSchema,
} from "@/lib/documents/types";
