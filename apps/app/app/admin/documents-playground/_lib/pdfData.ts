export function toPdfArrayBuffer(pdfFile: Uint8Array | null): ArrayBuffer | null {
	if (!pdfFile) {
		return null;
	}

	return pdfFile.buffer.slice(
		pdfFile.byteOffset,
		pdfFile.byteOffset + pdfFile.byteLength,
	);
}
