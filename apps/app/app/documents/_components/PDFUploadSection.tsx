'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { fillPDFForm } from '../_lib/fillPDFForm';
import type { PDFField } from '../_lib/parsePDFFormFields';
import { parsePDFFormFields } from '../_lib/parsePDFFormFields';

interface PDFUploadSectionProps {
  pdfFile: File | null;
  fieldValues: Record<string, string>;
  filledPdfUrl: string | null;
  onFileUpload: (file: File, fields: PDFField[]) => void;
  onPdfFilled: (url: string) => void;
}

export default function PDFUploadSection({
  pdfFile,
  fieldValues,
  filledPdfUrl,
  onFileUpload,
  onPdfFilled,
}: PDFUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsProcessing(true);
    try {
      const fields = await parsePDFFormFields(file);
      if (fields.length === 0) {
        toast.error(
          'No form fields found in this PDF. Please upload a PDF with fillable form fields.'
        );
        return;
      }
      onFileUpload(file, fields);
      toast.success(`Found ${fields.length} form fields`);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      toast.error('Failed to parse PDF form fields');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    if (!filledPdfUrl) return;
    const link = document.createElement('a');
    link.href = filledPdfUrl;
    link.download = `filled_${pdfFile?.name || 'document.pdf'}`;
    link.click();
  };

  // Update PDF when field values change
  useEffect(() => {
    if (!pdfFile || Object.keys(fieldValues).length === 0) return;

    const updatePDF = async () => {
      try {
        const filledPdfBytes = await fillPDFForm(pdfFile, fieldValues);
        const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Revoke old URL to prevent memory leaks
        if (filledPdfUrl) {
          URL.revokeObjectURL(filledPdfUrl);
        }

        onPdfFilled(url);
      } catch (error) {
        console.error('Error filling PDF:', error);
        toast.error('Failed to fill PDF form');
      }
    };

    updatePDF();
  }, [pdfFile, fieldValues]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (filledPdfUrl) {
        URL.revokeObjectURL(filledPdfUrl);
      }
    };
  }, [filledPdfUrl]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">PDF Preview</h3>
          {pdfFile && (
            <p className="text-muted-foreground text-sm">{pdfFile.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isProcessing}
            onClick={handleUploadClick}
            size="sm"
            type="button"
            variant="outline"
          >
            <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
            {pdfFile ? 'Change PDF' : 'Upload PDF'}
          </Button>
          {filledPdfUrl && (
            <Button onClick={handleDownload} size="sm" type="button">
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              Download
            </Button>
          )}
        </div>
      </div>

      <input
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      <div className="relative flex-1 overflow-hidden rounded-lg border bg-muted">
        {filledPdfUrl ? (
          <iframe
            className="h-full w-full"
            ref={iframeRef}
            src={filledPdfUrl}
            title="PDF Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Upload
                aria-hidden="true"
                className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
              />
              <p className="mb-2 font-medium text-foreground">
                No PDF uploaded
              </p>
              <p className="mb-4 text-muted-foreground text-sm">
                Upload a PDF with fillable form fields to get started
              </p>
              <Button onClick={handleUploadClick} type="button">
                <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
                Upload PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
