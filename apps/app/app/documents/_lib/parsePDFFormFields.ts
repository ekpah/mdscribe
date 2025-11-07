import { PDFDocument } from 'pdf-lib';

export interface PDFField {
  name: string;
  label: string;
  type: 'text' | 'multiline' | 'dropdown' | 'checkbox' | 'radio';
  value?: string;
  options?: string[];
}

/**
 * Parses a PDF file and extracts all fillable form fields
 * Similar to parseMarkdocToInputs but for PDF forms
 */
export async function parsePDFFormFields(file: File): Promise<PDFField[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();
  const fields: PDFField[] = [];

  const formFields = form.getFields();

  for (const field of formFields) {
    const fieldName = field.getName();
    const fieldType = field.constructor.name;

    // Create a readable label from the field name
    const label = fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    let pdfField: PDFField | null = null;

    switch (fieldType) {
      case 'PDFTextField': {
        const textField = field as any;
        const isMultiline = textField.isMultiline?.() || false;
        pdfField = {
          name: fieldName,
          label,
          type: isMultiline ? 'multiline' : 'text',
          value: textField.getText?.() || '',
        };
        break;
      }

      case 'PDFDropdown': {
        const dropdown = field as any;
        const options = dropdown.getOptions?.() || [];
        pdfField = {
          name: fieldName,
          label,
          type: 'dropdown',
          options,
          value: dropdown.getSelected?.()?.[0] || '',
        };
        break;
      }

      case 'PDFCheckBox': {
        const checkbox = field as any;
        pdfField = {
          name: fieldName,
          label,
          type: 'checkbox',
          value: checkbox.isChecked?.() ? 'true' : 'false',
        };
        break;
      }

      case 'PDFRadioGroup': {
        const radioGroup = field as any;
        const options = radioGroup.getOptions?.() || [];
        pdfField = {
          name: fieldName,
          label,
          type: 'radio',
          options,
          value: radioGroup.getSelected?.() || '',
        };
        break;
      }

      default:
        // Unknown field type, treat as text
        pdfField = {
          name: fieldName,
          label,
          type: 'text',
          value: '',
        };
    }

    if (pdfField) {
      fields.push(pdfField);
    }
  }

  return fields;
}
