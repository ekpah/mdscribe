import { describe, expect, test } from "bun:test";

import {
	getClipboardFiles,
	splitClipboardInputFiles,
} from "@/app/_components/input-context/clipboard";

describe("input-context clipboard files", () => {
	test("keeps audio separate from other pasted files", () => {
		const audio = new File(["audio"], "aufnahme.mp3", { type: "audio/mpeg" });
		const document = new File(["document"], "befund.pdf", {
			type: "application/pdf",
		});

		const result = splitClipboardInputFiles([audio, document]);

		expect(result.audioFiles).toEqual([audio]);
		expect(result.contextFiles).toEqual([document]);
	});

	test("uses clipboard items when a browser does not expose a file list", () => {
		const image = new File(["image"], "clipboard.png", { type: "image/png" });
		const clipboardData = {
			files: [] as unknown as FileList,
			items: [
				{
					getAsFile: () => image,
					kind: "file",
				},
			] as unknown as DataTransferItemList,
		};

		expect(getClipboardFiles(clipboardData)).toEqual([image]);
	});

	test("does not treat plain text as a file", () => {
		const clipboardData = {
			files: [] as unknown as FileList,
			items: [
				{
					getAsFile: () => null,
					kind: "string",
				},
			] as unknown as DataTransferItemList,
		};

		expect(getClipboardFiles(clipboardData)).toEqual([]);
	});
});
