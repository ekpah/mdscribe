'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { useState } from 'react';
import type { PDFField } from '../_lib/parsePDFFormFields';
import PDFFormInputs from './PDFFormInputs';
import PDFUploadSection from './PDFUploadSection';

export default function PDFFormSection() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFields, setPdfFields] = useState<PDFField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);

  const handleFileUpload = (file: File, fields: PDFField[]) => {
    setPdfFile(file);
    setPdfFields(fields);
    setFieldValues({});
    setFilledPdfUrl(null);
  };

  const handleFieldChange = (values: Record<string, string>) => {
    setFieldValues(values);
  };

  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
        key="Inputs"
      >
        <PDFFormInputs
          fields={pdfFields}
          onChange={handleFieldChange}
          values={fieldValues}
        />
      </div>
      <div
        className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
        key="Preview"
      >
        <PDFUploadSection
          fieldValues={fieldValues}
          filledPdfUrl={filledPdfUrl}
          onFileUpload={handleFileUpload}
          onPdfFilled={setFilledPdfUrl}
          pdfFile={pdfFile}
        />
      </div>
    </Card>
  );
}
