import { expect, test } from "bun:test";

test("real OpenRouter SDK sends the structured OCR contract for Mistral Large 4", async () => {
	// Run outside the suite's global AI/provider mocks, using a local HTTP endpoint.
	const child = Bun.spawn(
		[
			process.execPath,
			"--eval",
			`
		import assert from "node:assert/strict";
		import { mock } from "bun:test";
		mock.module("server-only", () => ({}));
		mock.module("@/env", () => ({ env: {} }));
		mock.module("next/cache", () => ({ unstable_cache: fn => fn, revalidateTag: () => {} }));
		const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
		const { createLlmOcrAdapter } = await import("./orpc/scribe/ocr/adapters/llm");
		const html = '<table><tr><td rowspan="2">A</td><td></td><td colspan="4">0,5 l<br>[x]</td></tr></table>';
		let calls = 0, invalidGeometry = false, malformed = false;
		const server = Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request) {
			assert.equal(new URL(request.url).pathname,"/chat/completions");
			assert.equal(request.headers.get("authorization"),"Bearer synthetic-key");
			const body = await request.json();
			assert.equal(body.model,"mistralai/mistral-large-4-0");
			assert.equal(body.response_format.type,"json_schema");
			const schema = body.response_format.json_schema.schema;
			assert.deepEqual(Object.keys(schema.properties).sort(),["blocks","text"]);
			assert.deepEqual(Object.keys(schema.properties.blocks.items.properties).sort(),["box_2d","text"]);
			const prompt = body.messages[0].content.map(part => part.text).join("");
			assert.match(prompt,/Represent every table as HTML/);
			assert.ok(prompt.includes("colspan/rowspan"));
			assert.match(prompt,/ymin, xmin, ymax, xmax/);
			assert.ok(body.messages[1].content[0].image_url.url.startsWith("data:image/jpeg;base64,"));
			assert.notEqual(body.stream,true);
			calls++;
			const output = {text:html,blocks:malformed ? "PRIVATE" : [{text:"Citation differs from full table",box_2d:invalidGeometry ? [100,-1,300,500] : [100,200,300,500]}]};
			return Response.json({id:"local",model:body.model,created:1,choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content:JSON.stringify(output)}}],usage:{prompt_tokens:5,completion_tokens:10,total_tokens:15}});
		}});
		try {
			const provider = createOpenRouter({apiKey:"synthetic-key",baseURL:server.url.toString().replace(/\\/$/,"")});
			const model = {model:provider("mistralai/mistral-large-4-0"),modelName:"mistralai/mistral-large-4-0",providerProtocol:"openrouter",isOpenRouter:true,credentialSource:"operator",providerId:"local",openRouterRoutingMode:"default",supportedParameters:["structured_outputs"],supportsReasoning:false};
			const usage = [];
			const adapter = createLlmOcrAdapter({modelSelection:{model,slot:"file-image",reasoningEffort:"none",defaultTemperature:0},userId:"test",onModelUsage:value=>usage.push(value)});
			const image = await (await import("sharp")).default({create:{width:600,height:800,channels:3,background:"white"}}).jpeg().toBuffer();
			const recognize = () => adapter.recognizePage({image,imageWidth:600,imageHeight:800,page:{pageNum:1,width:600,height:800}});
			const result = await recognize();
			assert.equal(result.text,html);
			assert.deepEqual(result.page.blocks[0].bbox,{x:120,y:80,width:180,height:160});
			assert.equal(usage.length,1);
			invalidGeometry = true;
			const invalid = await recognize();
			assert.equal(invalid.text,html);
			assert.equal(invalid.page,undefined);
			malformed = true;
			await assert.rejects(recognize(),/^Error: Die OCR-Modellanfrage ist fehlgeschlagen.$/);
			assert.equal(calls,3);
			console.log("Local OpenRouter structured OCR: OK");
		} finally { server.stop(true); }
	`,
		],
		{
			cwd: `${import.meta.dir}/../..`,
			env: { ...process.env, NODE_ENV: "test" },
			stderr: "pipe",
			stdout: "pipe",
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("Local OpenRouter structured OCR: OK");
}, 30_000);
