/** Render only the cited page, using the original aligned file retained in the browser. */
export const renderDocumentPage = async (
	file: File,
	pageNumber: number,
	signal?: AbortSignal,
): Promise<string> => {
	signal?.throwIfAborted();
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Document preview is not available.");
	}
	try {
		if (file.type.startsWith("image/")) {
			if (pageNumber !== 1) {
				throw new Error("Image page is not available.");
			}
			const image = await createImageBitmap(file, { imageOrientation: "from-image" });
			try {
				signal?.throwIfAborted();
				const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
				canvas.width = Math.round(image.width * scale);
				canvas.height = Math.round(image.height * scale);
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
			} finally {
				image.close();
			}
		} else if (file.type === "application/pdf") {
			// The minified build avoids PDF.js's internal Webpack variable names
			// colliding with Next's eval-source-map module wrapper in development.
			const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
			pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
			const loadingTask = pdfjs.getDocument({
				cMapUrl: "/cmaps/",
				data: new Uint8Array(await file.arrayBuffer()),
				standardFontDataUrl: "/standard_fonts/",
				wasmUrl: "/wasm/",
			});
			const abort = () => {
				void loadingTask.destroy();
			};
			signal?.addEventListener("abort", abort, { once: true });
			try {
				signal?.throwIfAborted();
				const pdf = await loadingTask.promise;
				const page = await pdf.getPage(pageNumber);
				const frame = page.getViewport({ scale: 1 });
				const viewport = page.getViewport({
					scale: Math.min(2, 2000 / Math.max(frame.width, frame.height)),
				});
				canvas.width = Math.ceil(viewport.width);
				canvas.height = Math.ceil(viewport.height);
				await page.render({ canvas, canvasContext: context, viewport }).promise;
			} finally {
				signal?.removeEventListener("abort", abort);
				await loadingTask.destroy();
			}
		} else {
			throw new Error("Document preview is not supported.");
		}
		signal?.throwIfAborted();
		return canvas.toDataURL("image/png");
	} finally {
		canvas.width = 0;
		canvas.height = 0;
	}
};
