import type { FieldMapping } from "./parsePDFFormFields";
import { PDFDocument } from "pdf-lib";

// Type for PDF form field with unknown methods
type PDFFormField = {
	setText?: (value: string) => void;
	select?: (value: string) => void;
	check?: () => void;
	uncheck?: () => void;
};

/**
 * Fills a PDF form with the provided field values
 * Maps from label (primary) back to field name using the fieldMapping
 * Returns the filled PDF as a Uint8Array
 */
export async function fillPDFForm(
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	fieldMapping: FieldMapping[],
): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.load(file);
	const form = pdfDoc.getForm();

	// Iterate through all form field values (using labels as keys)
	for (const [label, fieldValue] of Object.entries(fieldValues)) {
		// Map from label (primary) to actual PDF field name
		const mapping = fieldMapping.find((fm) => fm.label === label);
		if (!mapping) {
			console.warn(`No field mapping found for label: ${label}`);
			continue;
		}
		const fieldName = mapping.fieldName;

		// Convert field value to string for PDF filling
		const stringValue =
			typeof fieldValue === "string"
				? fieldValue
				: fieldValue?.toString() || "";
		console.log("Wert:", stringValue);
		try {
			const field = form.getField(fieldName);
			const fieldType = field.constructor.name;
			const pdfFormField = field as unknown as PDFFormField;
			console.log("Feldname:", fieldName);
			console.log("label:", label);
			console.log("fieldType:", fieldType);
			switch (fieldType) {
				case "PDFTextField": {
					pdfFormField.setText?.(stringValue);
					break;
				}

				case "PDFDropdown": {
					if (stringValue) {
						pdfFormField.select?.(stringValue);
					}
					break;
				}

				case "PDFCheckBox": {
					if (stringValue === "true") {
						pdfFormField.check?.();
					} else {
						pdfFormField.uncheck?.();
					}
					break;
				}

				case "PDFRadioGroup": {
					if (stringValue) {
						pdfFormField.select?.(stringValue);
					}
					break;
				}

				default:
					console.warn(`Unknown field type: ${fieldType} for ${fieldName}`);
			}
		} catch (error) {
			console.error(
				`Error filling field ${fieldName} (label: ${label}):`,
				error,
			);
		}
	}

	// Flatten the form to make the filled values permanent (optional)
	// form.flatten();

	return pdfDoc.save();
}
