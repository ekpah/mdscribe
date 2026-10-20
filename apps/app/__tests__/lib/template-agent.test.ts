import { describe, expect, test } from "bun:test";

import { templateSectionUpdateSchema } from "@/lib/template-section-update";
import { buildTemplateAgentSystemPrompt } from "@/orpc/template-agent/prompt";
import { createUpdateTemplateTool } from "@/orpc/template-agent/update-template-tool";

const execute = async (
	input: Parameters<NonNullable<ReturnType<typeof createUpdateTemplateTool>["execute"]>>[0],
) => {
	const { execute: run } = createUpdateTemplateTool();
	if (!run) {
		throw new Error("Missing tool executor");
	}
	return await run(input, { messages: [], toolCallId: "test" });
};

describe("template agent sections", () => {
	test("includes all current sections losslessly in prompt and explains calc reuse", () => {
		const sections = {
			content: "First\nSecond\n\nThird",
			examples: ["Example\nline"],
			information: "Instructions\n\nMore",
		};
		const prompt = buildTemplateAgentSystemPrompt(sections);
		// Verbatim, not JSON-escaped: escaped quotes were copied into new tags.
		expect(prompt).toContain(`<content>\n${sections.content}\n</content>`);
		expect(prompt).toContain(`<example>\n${sections.examples[0]}\n</example>`);
		expect(prompt).toContain(`<information>\n${sections.information}\n</information>`);
		expect(prompt).toContain("A number info, a condition, and a calc may share a name");
		expect(prompt).toContain("Preserve line breaks");
	});

	test("updates each section independently without returning untouched sections", async () => {
		for (const update of [
			{ content: "Text\n\nMore" },
			{ examples: ["One\nTwo"] },
			{ information: "Info\n\nMore" },
		]) {
			expect(await execute(update)).toEqual({ ...update, ok: true });
		}
	});

	test("supports combined changes and explicit clearing", async () => {
		expect(await execute({ content: "", examples: [], information: "" })).toEqual({
			content: "",
			examples: [],
			information: "",
			ok: true,
		});
	});

	test("rejects invalid content atomically even with valid other sections", async () => {
		expect(
			await execute({ content: '{% info "x" type="invalid" /%}', information: "Good" }),
		).toMatchObject({ ok: false });
	});

	test("reports the line of each error so the agent can locate it", async () => {
		const result = await execute({
			content: 'Intro\n\nA {% condition "x" %}{% case gte=0 %}X\n\nY{% /case %}{% /condition %}',
		});
		expect(result).toMatchObject({ ok: false });
		const lines = String((result as { error: string }).error)
			.split("\n")
			.map((line) => /^Zeile (\d+):/u.exec(line)?.[1]);
		expect(lines).toContain("3");
		expect(lines).toContain("5");
		expect(lines).not.toContain(undefined);
	});

	test("accepts a named calc reused through a compatible info declaration", async () => {
		const content = `{% calc primary="score" formula="[age] * 2" %}
{% info "age" type="number" /%}
{% /calc %}

{% calc primary="adjusted" formula="[score] + 1" %}
{% info "score" type="number" /%}
{% /calc %}`;
		expect(await execute({ content })).toEqual({ content, ok: true });
	});

	test("enforces section shapes, limits, and nonempty updates", async () => {
		for (const invalid of [
			{},
			{ examples: Array.from({ length: 11 }, () => "x") },
			{ information: "x".repeat(10_001) },
			{ content: "x".repeat(100_001) },
		]) {
			expect(await execute(invalid)).toMatchObject({ ok: false });
		}
		expect(templateSectionUpdateSchema.safeParse({ examples: [1] }).success).toBe(false);
		expect(templateSectionUpdateSchema.safeParse({ information: null }).success).toBe(false);
	});
});
