// 10MB
export const MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024;

export const toPdfBlobUrl = (pdfFile: Uint8Array | null): string | null => {
	if (!pdfFile) {
		return null;
	}

	try {
		// Use a Blob URL to avoid detached ArrayBuffer issues with worker transfers.
		const blob = new Blob([[...pdfFile]], { type: "application/pdf" });
		return URL.createObjectURL(blob);
	} catch (error) {
		console.error("Failed to convert PDF bytes to Blob URL:", error);
		return null;
	}
};
