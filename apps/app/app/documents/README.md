# PDF Form Filling - Proof of Concept

This page demonstrates PDF form filling capabilities using `pdf-lib`.

## Features

- **Upload PDF Forms**: Upload any PDF document with fillable form fields
- **Parse Form Fields**: Automatically extracts all form fields from the PDF
- **Fill Forms**: Interactive form on the left side to fill in values
- **Live Preview**: Real-time preview of the filled PDF on the right side
- **Download**: Download the filled PDF with all values populated

## Supported Field Types

- **Text Fields**: Single-line text inputs
- **Text Areas**: Multi-line text inputs
- **Dropdowns**: Select from predefined options
- **Checkboxes**: Boolean on/off values
- **Radio Groups**: Select one option from multiple choices

## How It Works

1. **Upload**: Click "Upload PDF" and select a PDF file with fillable form fields
2. **Parse**: The app uses `pdf-lib` to extract all form field definitions
3. **Fill**: Form inputs are dynamically generated on the left side based on the PDF fields
4. **Update**: As you type, the PDF is automatically updated with your values
5. **Download**: Click "Download" to save the filled PDF

## Implementation Details

### Key Files

- `page.tsx`: Main page component
- `_components/PDFFormSection.tsx`: Main container managing state
- `_components/PDFFormInputs.tsx`: Dynamic form inputs on the left
- `_components/PDFUploadSection.tsx`: PDF upload and preview on the right
- `_lib/parsePDFFormFields.ts`: Extracts form fields from PDF (analogous to parseMarkdocToInputs)
- `_lib/fillPDFForm.ts`: Fills PDF form fields with values

### Architecture Pattern

This implementation follows the same pattern as the template system:

**Templates System:**
- `parseMarkdocToInputs`: Parses Markdoc content → input tags
- `Inputs`: Renders form inputs from parsed tags
- `DynamicMarkdocRenderer`: Renders filled content

**PDF Form System:**
- `parsePDFFormFields`: Parses PDF form → field definitions
- `PDFFormInputs`: Renders form inputs from field definitions
- PDF viewer: Displays filled PDF

## Testing

To test this feature:

1. Navigate to `/documents`
2. Upload a PDF with form fields (you can create one using Adobe Acrobat or any PDF form creator)
3. Fill in the form fields on the left
4. Watch the PDF update in real-time on the right
5. Download the filled PDF

## Future Enhancements

- Support for signature fields
- Form field validation
- Save/load form data
- Multiple PDF templates
- Batch PDF filling
- Form field templates
