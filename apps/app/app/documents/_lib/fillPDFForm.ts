import { PDFDocument } from 'pdf-lib';

/**
 * Fills a PDF form with the provided field values
 * Returns the filled PDF as a Uint8Array
 */
export async function fillPDFForm(
  file: File,
  fieldValues: Record<string, string>
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();

  // Iterate through all form fields and fill them
  for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
    try {
      const field = form.getField(fieldName);
      const fieldType = field.constructor.name;

      switch (fieldType) {
        case 'PDFTextField': {
          const textField = field as any;
          textField.setText(fieldValue);
          break;
        }

        case 'PDFDropdown': {
          const dropdown = field as any;
          if (fieldValue) {
            dropdown.select(fieldValue);
          }
          break;
        }

        case 'PDFCheckBox': {
          const checkbox = field as any;
          if (fieldValue === 'true') {
            checkbox.check();
          } else {
            checkbox.uncheck();
          }
          break;
        }

        case 'PDFRadioGroup': {
          const radioGroup = field as any;
          if (fieldValue) {
            radioGroup.select(fieldValue);
          }
          break;
        }

        default:
          console.warn(`Unknown field type: ${fieldType} for ${fieldName}`);
      }
    } catch (error) {
      console.error(`Error filling field ${fieldName}:`, error);
    }
  }

  // Flatten the form to make the filled values permanent (optional)
  // form.flatten();

  return pdfDoc.save();
}
