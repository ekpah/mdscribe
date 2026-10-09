import { expect, test } from "bun:test";
import { execPath } from "node:process";

import { renderToStaticMarkup } from "react-dom/server";

import {
	OcrImagePreview,
	OcrTextPreview,
} from "@/app/_components/input-context/inputs/document/ocr-preview";

test("OCR preview preserves merged cells without trusting model HTML attributes", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview
			text={
				'<html><body><table onclick="alert(1)" style="display:none"><tr><td colspan="4" rowspan="2">bei Bedarf<br>1–2 Hübe</td><td>Max. 8 Hübe/Tag</td></tr></table><script>alert(1)</script><img src="https://tracker.invalid" onerror="alert(1)"><svg onload="alert(1)"></svg><iframe srcdoc="unsafe"></iframe><p>FEV1 &lt; 2 l</p></body></html>'
			}
		/>,
	);
	expect(html).toContain('<td colSpan="4" rowSpan="2">bei Bedarf<br/>1–2 Hübe</td>');
	expect(html).toContain("Max. 8 Hübe/Tag");
	expect(html).toContain("FEV1 &lt; 2 l");
	// Unknown markup is shown as inert text, never as elements or attributes.
	expect(html).not.toMatch(/<(script|img|svg|iframe)|\s(on\w+|style|src|srcdoc)="/);
	expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("keeps text that only looks like markup, such as lab thresholds", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview text={"Troponin <Nachweisgrenze, CRP 3\nKOF 1,73 m<sup>2</sup>"} />,
	);
	expect(html).toContain("Troponin &lt;Nachweisgrenze, CRP 3<br/>KOF 1,73 m<sup>2</sup>");
});

test("renders mixed Markdown and HTML tables through the inert allowlist", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview
			text={
				'# Befund\n\n**Dosis** und *Hinweis*\nZeile 2\n\n- Eins\n- Zwei\n\n| Labor | Wert |\n| --- | --- |\n| CRP | <5 |\n| Troponin | <NWG |\n\n<table><tr><td colspan="2" rowspan="2">Dose</td><td>1</td></tr><tr><td>0</td></tr></table>\n\n`code`'
			}
		/>,
	);
	expect(html).toContain("<h1>Befund</h1><p>");
	expect(html).toContain("<strong>Dosis</strong> und <em>Hinweis</em><br/>Zeile 2");
	expect(html).toContain("<ul><li>Eins</li><li>Zwei</li></ul>");
	expect(html).toContain("<td>&lt;5</td>");
	expect(html).toContain("<td>&lt;NWG</td>");
	expect(html).toContain('<td colSpan="2" rowSpan="2">Dose</td>');
	expect(html).toContain("<code>code</code>");
});

test("Markdown URLs and template tags never become active elements", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview
			text={
				'[safe label](https://tracker.invalid) [bad](javascript:alert%281%29) ![image](https://tracker.invalid/pixel)\n\n{% if $secret %}{{ secret }}{% /if %}\n\n<a href="javascript:alert(1)">HTML link</a><img src=x onerror=alert(1)><p style="color:red" onclick="alert(1)">Text</p>'
			}
		/>,
	);
	expect(html).toContain("safe label");
	expect(html).toContain("bad");
	expect(html).toContain("{% if $secret %}{{ secret }}{% /if %}");
	expect(html).not.toMatch(/<(a|img|script|iframe|svg)\b|\s(href|src|style|on\w+)="/);
	expect(html).toContain("<p>Text</p>");
});

test("Markdown task lists preserve selection markers without creating form controls", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview text={"- [x] Asthma\n- [ ] COPD\n- [?] unklar\n\n[x] Ja  [ ] Nein"} />,
	);
	expect(html).toContain("<li>[x] Asthma</li>");
	expect(html).toContain("<li>[ ] COPD</li>");
	expect(html).toContain("<li>[?] unklar</li>");
	expect(html).toContain("[x] Ja  [ ] Nein");
	expect(html).not.toContain("<input");
});

test("only retains integer cell spans from 1 through 1000", () => {
	const text =
		'<table><tr><td colspan="1000" rowspan="1">ok</td><td colspan="1001" rowspan="0">large</td><td colspan="-2" rowspan="1.5">invalid</td></tr></table>';
	const html = renderToStaticMarkup(<OcrTextPreview text={text} />);
	expect(html).toContain('<td colSpan="1000" rowSpan="1">ok</td>');
	expect(html).toContain("<td>large</td><td>invalid</td>");
});

test("indented tables keep adjacent rows in one row group for rowspan", () => {
	const html = renderToStaticMarkup(
		<OcrTextPreview
			text={
				'<table>\n<tr>\n<td rowspan="2">Dose</td><td>1</td>\n</tr>\n<tr><td>0</td></tr>\n</table>'
			}
		/>,
	);
	expect(html).toContain(
		'<table><tbody><tr><td rowSpan="2">Dose</td><td>1</td></tr><tr><td>0</td></tr></tbody></table>',
	);
});

const page = {
	blocks: [{ bbox: { height: 19, width: 41, x: 23, y: 71 }, text: "<script>dose</script>" }],
	height: 800,
	width: 600,
};
const render = (props: Partial<Parameters<typeof OcrImagePreview>[0]>) =>
	renderToStaticMarkup(
		<OcrImagePreview
			alt="Vorschau"
			page={page}
			previewUrl="blob:original"
			showRegions
			viewRotation={0}
			{...props}
		/>,
	);
const box = /<rect[^>]*height="19"[^>]*width="41"[^>]*x="23"[^>]*y="71"/;

test("draws boxes in the page frame over the image, and can hide them", () => {
	const html = render({});
	expect(html).toContain('viewBox="0 0 600 800"');
	expect(html).toContain('<image height="800" href="blob:original" width="600"');
	expect(html).toMatch(box);
	expect(html).toContain("&lt;script&gt;dose&lt;/script&gt;");
	expect(render({ showRegions: false })).not.toContain("<rect");
});

test.each([
	[90, "0 0 800 600", "translate(800 0) rotate(90)"],
	[180, "0 0 600 800", "translate(600 800) rotate(180)"],
	[270, "0 0 800 600", "translate(0 600) rotate(270)"],
] as const)(
	"turns image and boxes together when the user rotates the view by %d degrees",
	(viewRotation, viewBox, transform) => {
		const html = render({ viewRotation });
		expect(html).toContain(`viewBox="${viewBox}"`);
		expect(html).toContain(`<g transform="${transform}"><image`);
		expect(html).toMatch(box);
	},
);

test("generation OCR replaces existing preview text and boxes without clearing unmatched files", async () => {
	// Isolate hook dependencies so these mocks cannot affect other app tests.
	const process = Bun.spawn(
		[
			execPath,
			"--eval",
			`
			import assert from "node:assert/strict";
			import { mock } from "bun:test";
			import * as React from "react";
			import { renderToStaticMarkup } from "react-dom/server";
			let files;
			let stateIndex = 0;
			mock.module("react", () => ({
				...React,
				useCallback: callback => callback,
				useEffect: () => {},
				useRef: current => ({ current }),
				useState: initial => {
					const index = stateIndex++;
					return [initial, next => { if (index === 1) files = next; }];
				},
			}));
			mock.module("@repo/design-system/components/inputs/audio-submission", () => ({
				blobToBase64: async () => "",
				createAudioSubmissionFile: async () => ({}),
			}));
			mock.module("@/lib/orpc", () => ({ orpc: {} }));
			mock.module("sonner", () => ({ toast: {} }));
			const { useInputContextState } = await import("./app/_components/input-context/use-input-context-state.ts");
			const { OcrTextPreview, OcrImagePreview } = await import("./app/_components/input-context/inputs/document/ocr-preview.tsx");
			const controller = useInputContextState();
			const previous = { backend: "llm", text: "5 mg", pages: [{ pageNumber: 1, width: 600, height: 800, blocks: [] }] };
			const uploaded = ["first", "second", "third"].map(id => ({
				id, file: new File([id], id + ".png", { type: "image/png" }),
				ocrResult: previous, ocrStatus: "complete",
			}));
			controller.setContextFiles(uploaded);
			const current = {
				backend: "llm", text: "10 mg", pages: [{
					pageNumber: 1, width: 800, height: 600,
					blocks: [{ text: "10 mg", bbox: { x: 77, y: 29, width: 41, height: 19 } }],
				}],
			};
			const blank = { backend: "llm", text: "", pages: [] };
			controller.setContextFileOcrResults([current, blank]);
			assert.deepEqual(files[0].ocrResult, current);
			assert.deepEqual(files[1].ocrResult, blank);
			assert.equal(files[2], uploaded[2]);
			const textHtml = renderToStaticMarkup(React.createElement(OcrTextPreview, { text: files[0].ocrResult.text }));
			assert.ok(textHtml.includes("10 mg") && !textHtml.includes("5 mg"));
			const imageHtml = renderToStaticMarkup(React.createElement(OcrImagePreview, {
				alt: "Preview", page: files[0].ocrResult.pages[0], previewUrl: "blob:original",
				showRegions: true, viewRotation: 0,
			}));
			assert.ok(imageHtml.includes('viewBox="0 0 800 600"'));
			assert.ok(imageHtml.includes('x="77"') && imageHtml.includes('y="29"'));
			console.log("Generation OCR preview refresh: OK");
			`,
		],
		{ stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("Generation OCR preview refresh: OK");
});

test("images wait for manual alignment even on submit; PDFs and confirmed images run OCR", async () => {
	const child = Bun.spawn(
		[
			execPath,
			"--eval",
			`
			import assert from "node:assert/strict";
			import { mock } from "bun:test";
			import * as React from "react";
			let stateIndex, refIndex, effects;
			const states = [], refs = [], calls = [];
			let native = false;
			let configured = true, documentModel = "document-v1", encodes = 0;
			mock.module("react", () => ({
				...React,
				useCallback: fn => fn,
				useEffect: fn => effects.push(fn),
				useRef: value => refs[refIndex++] ??= {current:value},
				useState: value => {
					const index = stateIndex++;
					states[index] ??= value;
					return [states[index], next => states[index] = typeof next === "function" ? next(states[index]) : next];
				},
			}));
			mock.module("@repo/design-system/components/inputs/audio-submission", () => ({
				blobToBase64: async file => { encodes++; return Buffer.from(await file.arrayBuffer()).toString("base64"); },
				createAudioSubmissionFile: async () => ({}),
			}));
			mock.module("sonner", () => ({toast:{error:message=>{throw Error(message)}}}));
			mock.module("@/lib/orpc", () => ({orpc:{scribe:{
				documentInputPolicy:{call:async()=>({ocrConfigured:configured,supportsDocuments:native,agentSupportsDocuments:native})},
				extractContextFile:{call:async({file})=>{
					calls.push(file.name);
					return {result:{backend:"llm",text:documentModel+" "+file.name,pages:[{pageNumber:1,width:600,height:800,blocks:[{text:"confirmed",bbox:{x:17,y:39,width:83,height:21}}]}]}};
				}},
			}}}));
			const {useInputContextState} = await import("./app/_components/input-context/use-input-context-state.ts");
			const render = () => {
				stateIndex = refIndex = 0; effects = [];
				const controller = useInputContextState();
				for (const effect of effects) effect();
				return controller;
			};
			let controller = render();
			const image = new File(["image"], "scan.png", {type:"image/png"});
			assert.equal(controller.addContextFiles([image]),true);
			controller = render();
			assert.equal(controller.contextFiles[0].ocrStatus,"awaiting-alignment");
			await assert.rejects(controller.prepareSubmission(),/manuell ausrichten/);
			assert.deepEqual(calls,[]);
			// A selected document model takes precedence over native vision.
			native = true;
			await assert.rejects(controller.prepareSubmission(),/manuell ausrichten/);
			assert.deepEqual(calls,[]);
			controller.retryContextFileOcr(controller.contextFiles[0].id);
			const submission = await controller.prepareSubmission();
			assert.equal(submission.contextFiles[0].kind,"ocr");
			assert.ok(!("data" in submission.contextFiles[0]));
			assert.deepEqual(Object.keys(submission.contextFiles[0]).sort(),["kind","name","ocrResult"]);
			assert.deepEqual(submission.contextFiles[0].ocrResult.pages[0].blocks[0].bbox,{x:17,y:39,width:83,height:21});
			assert.equal(encodes,1);
			await controller.prepareSubmission();
			assert.equal(encodes,1);
			controller = render();
			assert.deepEqual(calls,["scan.png"]);
			assert.equal(controller.contextFiles[0].ocrResult.text,"document-v1 scan.png");
			assert.equal(controller.contextFiles[0].ocrStatus,"complete");
			// Neither elapsed time nor an OCR model change reuploads or retranscribes a completed document.
			const now = Date.now;
			try {
				Date.now = () => now() + 24 * 60 * 60_000;
				assert.deepEqual(await controller.prepareSubmission(),submission);
			} finally { Date.now = now; }
			documentModel = "document-v2";
			assert.deepEqual(await controller.prepareSubmission(),submission);
			assert.equal(calls.length,1);
			assert.equal(encodes,1);
			// An explicit retry still runs OCR with the new model and updates the submitted result.
			controller.retryContextFileOcr(controller.contextFiles[0].id);
			const retried = await controller.prepareSubmission();
			assert.equal(retried.contextFiles[0].ocrResult.text,"document-v2 scan.png");
			assert.equal(calls.length,2);
			assert.equal(encodes,2);
			// Replacements without status cannot bypass the manual-image gate.
			controller.setContextFiles([{id:"raw",file:image}]);
			controller = render();
			await assert.rejects(controller.prepareSubmission(),/manuell ausrichten/);
			assert.deepEqual(calls,["scan.png","scan.png"]);
			controller.setContextFiles([]);
			controller.addContextFiles([new File(["pdf"],"letter.pdf",{type:"application/pdf"})]);
			controller = render();
			await controller.prepareSubmission();
			assert.deepEqual(calls,["scan.png","scan.png","letter.pdf"]);
			// Without a document model, no OCR occurs and native vision gets original bytes.
			configured = false;
			controller.setContextFiles([{id:"no-ocr",file:image}]);
			controller = render();
			const raw = (await controller.prepareSubmission()).contextFiles[0];
			assert.equal(raw.data,Buffer.from("image").toString("base64"));
			assert.ok(!("ocrResult" in raw) && !("ocrResultToken" in raw));
			assert.equal(calls.length,3);
			native = false;
			await assert.rejects(controller.prepareSubmission(),/Vision-fähiges/);
			console.log("Manual image gate and automatic PDF OCR: OK");
			`,
		],
		{ cwd: `${import.meta.dir}/../..`, stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("Manual image gate and automatic PDF OCR: OK");
});
