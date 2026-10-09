import { expect, test } from "bun:test";

test("Tinfoil OCR uses verified SDK transport for image and structured response, with no insecure fallback", async () => {
	// Keep the real AI SDK/OpenAI-compatible bridge, outside global inference mocks.
	const child = Bun.spawn(
		[
			process.execPath,
			"--eval",
			`
		import assert from "node:assert/strict";
		import { mock } from "bun:test";
		mock.module("server-only", () => ({}));
		mock.module("next/cache", () => ({ unstable_cache: fn => fn, revalidateTag: () => {} }));
		mock.module("@/lib/encryption", () => ({ decrypt: async key => key }));
		let verified = false, calls = 0, rejectAttestation = false;
		mock.module("tinfoil", () => ({
			SecureClient: class {
				async ready() { if (rejectAttestation) throw Error("attestation failed"); verified = true; }
				getBaseURL() { return "https://verified-enclave.invalid/v1"; }
				fetch = async (url, init) => {
					assert.ok(verified);
					assert.equal(String(url), "https://verified-enclave.invalid/v1/chat/completions");
					const body = JSON.parse(init.body);
					assert.equal(body.model, "gemma4-31b");
					assert.ok(body.messages[1].content[0].image_url.url.startsWith("data:image/jpeg;base64,"));
					assert.ok(body.response_format);
					calls++;
					return Response.json({id:"test",model:body.model,created:1,choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content:JSON.stringify({text:"dose",blocks:[{text:"dose",box_2d:[100,200,300,500]}]})}}],usage:{prompt_tokens:5,completion_tokens:10,total_tokens:15}});
				};
			}, TinfoilAI: class {}, toFile: () => {},
		}));
		const { resolveModelByRecordId } = await import("./orpc/scribe/providers");
		const { createLlmOcrAdapter } = await import("./orpc/scribe/ocr/adapters/llm");
		let row = {model:{id:"vision",modelId:"gemma4-31b",supportedParameters:[],supportsReasoning:false},provider:{id:"tinfoil",protocol:"tinfoil",apiKey:"key",baseUrl:null}};
		const query = {from:()=>query,innerJoin:()=>query,where:()=>query,limit:async()=>[row]};
		const db = {select:()=>query};
		const model = await resolveModelByRecordId("vision",db);
		const image = await (await import("sharp")).default({create:{width:600,height:800,channels:3,background:"white"}}).jpeg().toBuffer();
		const adapter = createLlmOcrAdapter({modelSelection:{model,slot:"file-image",reasoningEffort:"none",defaultTemperature:0},userId:"test"});
		const result = await adapter.recognizePage({image,imageWidth:600,imageHeight:800,page:{pageNum:1,width:600,height:800}});
		assert.equal(calls,1);
		assert.equal(result.text,"dose");
		assert.deepEqual(result.page.blocks[0].bbox,{x:120,y:80,width:180,height:160});
		rejectAttestation = true;
		row = {...row,provider:{...row.provider,id:"other",apiKey:"other"}};
		await assert.rejects(resolveModelByRecordId("other",db),/attestation failed/);
		assert.equal(calls,1);
		console.log("Verified transport, image, structured OCR and fail-closed: OK");
	`,
		],
		{ env: { ...process.env, NODE_ENV: "test" }, stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("fail-closed: OK");
}, 30_000);
