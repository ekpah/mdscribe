import sharp from "sharp";

import type { OcrPageImage } from "@/orpc/scribe/ocr/adapter";

const MAX_INPUT_PIXELS = 50_000_000;
// Keeps camera photos below inline request limits (HTTP 413) while staying
// sharp enough for small print. Aspect ratio is preserved.
const MAX_IMAGE_SIDE = 3000;

const encodePageImage = async (data: Buffer) => {
	const { data: image, info } = await sharp(data, { limitInputPixels: MAX_INPUT_PIXELS })
		.autoOrient()
		.resize({
			fit: "inside",
			height: MAX_IMAGE_SIDE,
			width: MAX_IMAGE_SIDE,
			withoutEnlargement: true,
		})
		.flatten({ background: "white" })
		.jpeg({ quality: 90 })
		.toBuffer({ resolveWithObject: true });
	return { image, imageHeight: info.height, imageWidth: info.width };
};

/**
 * Renders a PDF or image into OCR page images. Only PDFs need a document renderer.
 * @yields {OcrPageImage} Each page as an EXIF-corrected, bounded JPEG with its original page frame.
 */
export const renderPageImages = async function* renderPageImages(
	data: Buffer,
	mimeType: string,
): AsyncGenerator<OcrPageImage> {
	if (mimeType.startsWith("image/")) {
		const {
			height = 0,
			orientation = 1,
			width = 0,
		} = await sharp(data, {
			limitInputPixels: MAX_INPUT_PIXELS,
		}).metadata();
		// EXIF orientations 5–8 swap the displayed axes.
		const sideways = orientation >= 5;
		yield {
			...(await encodePageImage(data)),
			page: { height: sideways ? width : height, pageNum: 1, width: sideways ? height : width },
		};
		return;
	}
	if (mimeType !== "application/pdf") {
		throw new Error("Nur Bilder und PDF-Dateien können analysiert werden.");
	}
	const { LiteParse } = await import("@llamaindex/liteparse");
	const parser = new LiteParse({ numWorkers: 1, ocrEnabled: false, quiet: true });
	try {
		const parsed = await parser.parse(data);
		if (parsed.pages.length !== parsed.totalPages || parsed.pageErrors.length > 0) {
			throw new Error("Das Dokument konnte nicht vollständig gelesen werden.");
		}
		for (const { height, pageNum, width } of parsed.pages) {
			const [rendered] = await parser.screenshot(data, [pageNum]);
			if (!rendered) {
				throw new Error("Die Dokumentseite konnte nicht gerendert werden.");
			}
			yield { ...(await encodePageImage(rendered.imageBuffer)), page: { height, pageNum, width } };
		}
	} finally {
		parser.close();
	}
};
