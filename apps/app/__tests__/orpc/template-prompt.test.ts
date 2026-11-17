import { describe, expect, test } from "bun:test";

import { splitSectionOutput } from "@/features/template-tags/sections";
import { composeTemplatePrompt, evidenceInputs } from "@/orpc/scribe/prompts/template";

const LETTER = `{% section id="diagnosen" title="Diagnosen" %}
((Hauptdiagnose))
{% /section %}

{% section id="epikrise" title="Epikrise" %}
Verlauf: {% info "Verlauf" /%}
{% /section %}`;

const template = { content: LETTER, examples: [], information: "", title: "Entlassbrief" };

describe("template prompt", () => {
	test("a sectioned template asks for section tags and allows only them as Markdoc output", () => {
		const [system, user] = composeTemplatePrompt({ notes: "Notizen", template });
		expect(system?.content).toContain(
			'{% section id="…" %}fertiger Text des Abschnitts{% /section %}',
		);
		expect(system?.content).toContain("außer den {% section %}-Rahmen niemals Markdoc-Syntax");
		expect(system?.content).not.toContain("niemals Markdoc-Syntax aus (kein {% ... %})");
		// The template reaches the model unchanged.
		expect(user?.content).toContain(LETTER);
	});

	test("section regeneration sends every section, including the target's draft, and names the target", () => {
		const input = {
			background: " Labor: CRP 112 ",
			notes: "Rö-Thorax: Infiltrat re.",
			sections: { diagnosen: "Pneumonie (bearbeitet)", epikrise: "alter Text" },
			targetSectionId: "epikrise",
			template,
			todaysDate: "18.10.2026",
		};
		const [, user] = composeTemplatePrompt(input);
		// Citations point only to evidence, by the id in the prompt: never to typed notes
		// or to the letter's own sections, which a regeneration overwrites.
		expect(evidenceInputs(input)).toEqual([
			{ id: "background", name: "Hintergrundinformationen", text: "Labor: CRP 112" },
		]);
		const document = user?.content.match(/<dokument>([\s\S]*)<\/dokument>/)?.[1] ?? "";
		// The context uses the same syntax as the answer, so it splits the same way.
		expect(splitSectionOutput(document)).toEqual({
			diagnosen: "Pneumonie (bearbeitet)",
			epikrise: "alter Text",
		});
		expect(user?.content).toContain('id="epikrise") neu');
	});

	test("Hintergrundinformationen reach the model as <kontext> with the do-not-copy rule", () => {
		const [system, user] = composeTemplatePrompt({
			background: "  Labor 02.10.: Na 139, K 4,6  ",
			notes: "Notizen",
			template,
		});
		expect(system?.content).toContain(
			"<kontext> enthält Hintergrundinformationen von vor der aktuellen Vorstellung",
		);
		expect(user?.content).toContain(
			'<kontext id="background">\nLabor 02.10.: Na 139, K 4,6\n</kontext>',
		);
		expect(user?.content).toContain('<notizen id="notes">\nNotizen\n</notizen>');

		const [, withoutBackground] = composeTemplatePrompt({
			background: " ",
			notes: "Notizen",
			template,
		});
		expect(withoutBackground?.content).not.toContain("<kontext>");
	});

	test("templates without sections ask for plain text without Markdoc", () => {
		const [system] = composeTemplatePrompt({
			notes: "Notizen",
			template: { content: "((Text))", examples: [], information: "", title: "Kurz" },
		});
		expect(system?.content).not.toContain("{% section");
		expect(system?.content).toContain("niemals Markdoc-Syntax aus (kein {% ... %})");
	});

	test("regenerating a template without sections sends its current text as the draft", () => {
		const shortTemplate = { content: "((Text))", examples: [], information: "", title: "Kurz" };
		const [, user] = composeTemplatePrompt({
			notes: "Notizen",
			sections: { text: "bisheriger Entwurf" },
			targetSectionId: "text",
			template: shortTemplate,
		});
		expect(user?.content).toContain("<entwurf>\nbisheriger Entwurf\n</entwurf>");
		expect(user?.content).not.toContain("<dokument>");
		// A first generation has no draft to rewrite.
		const [, first] = composeTemplatePrompt({
			notes: "Notizen",
			sections: { text: "" },
			targetSectionId: "text",
			template: shortTemplate,
		});
		expect(first?.content).not.toContain("<entwurf>");
	});
});
