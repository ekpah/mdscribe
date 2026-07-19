export const MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BASE64_LENGTH = Math.ceil(MAX_PDF_UPLOAD_BYTES / 3) * 4;
export const MAX_PDF_PAGE_COUNT = 500;
export const MAX_PDF_FORM_FIELD_COUNT = 2000;
export const MAX_PDF_WIDGET_COUNT = 5000;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const cloneUint8Array = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes);

export const decodeBase64ToUint8Array = (value: string): Uint8Array => {
	if (typeof atob === "function") {
		const binary = atob(value);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.codePointAt(index) ?? 0;
		}
		return bytes;
	}

	return new Uint8Array(Buffer.from(value, "base64"));
};

export const encodeUint8ArrayToBase64 = (data: Uint8Array): string => {
	if (typeof btoa === "function") {
		const chunkSize = 0x80_00;
		let binary = "";
		for (let index = 0; index < data.length; index += chunkSize) {
			const chunk = data.subarray(index, index + chunkSize);
			binary += String.fromCodePoint(...chunk);
		}
		return btoa(binary);
	}

	return Buffer.from(data).toString("base64");
};

export const toPdfBlob = (pdfBytes: Uint8Array): Blob =>
	new Blob([toArrayBuffer(pdfBytes)], { type: "application/pdf" });

export const downloadPdfBlob = (blob: Blob, fileName: string) => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

export const printPdfBlob = (blob: Blob) => {
	const url = URL.createObjectURL(blob);
	const printWindow = window.open(url, "_blank");
	if (!printWindow) {
		return;
	}
	printWindow.addEventListener("load", () => printWindow.print());
};
