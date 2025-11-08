import { PDFDocument } from 'pdf-lib';

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
  file: File,
  fieldValues: Record<string, unknown>,
  fieldMapping: Record<string, string>
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();

  // Iterate through all form field values (using labels as keys)
  for (const [label, fieldValue] of Object.entries(fieldValues)) {
    // Map from label (primary) to actual PDF field name
    const fieldName = fieldMapping[label];
    if (!fieldName) {
      console.warn(`No field mapping found for label: ${label}`);
      continue;
    }

    // Convert field value to string for PDF filling
    const stringValue =
      typeof fieldValue === 'string'
        ? fieldValue
        : fieldValue?.toString() || '';

    try {
      const field = form.getField(fieldName);
      const fieldType = field.constructor.name;
      const pdfFormField = field as unknown as PDFFormField;

      switch (fieldType) {
        case 'PDFTextField': {
          pdfFormField.setText?.(stringValue);
          break;
        }

        case 'PDFDropdown': {
          if (stringValue) {
            pdfFormField.select?.(stringValue);
          }
          break;
        }

        case 'PDFCheckBox': {
          if (stringValue === 'true') {
            pdfFormField.check?.();
          } else {
            pdfFormField.uncheck?.();
          }
          break;
        }

        case 'PDFRadioGroup': {
          if (stringValue) {
            pdfFormField.select?.(stringValue);
          }
          break;
        }

        default:
          console.warn(`Unknown field type: ${fieldType} for ${fieldName}`);
      }
    } catch (error) {
      console.error(`Error filling field ${fieldName} (label: ${label}):`, error);
    }
  }

  // Flatten the form to make the filled values permanent (optional)
  // form.flatten();

  return pdfDoc.save();
}
