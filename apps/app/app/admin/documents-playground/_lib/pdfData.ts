export function toPdfArrayBuffer(pdfFile: Uint8Array | null): ArrayBuffer | null {
	if (!pdfFile) {
		return null;
	}

	// Create a copy to get a proper ArrayBuffer (not SharedArrayBuffer)
	return pdfFile.slice().buffer as ArrayBuffer;
}
