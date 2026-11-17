import { describe, expect, test } from "bun:test";

import type { ExchangeTemplate } from "@/lib/template-exchange";
import {
	ExchangeFormatError,
	parseExchange,
	serializeCollection,
	serializeTemplate,
} from "@/lib/template-exchange";

// Shapes taken from real templates: Markdown headings and `---` in the notes, hard line
// breaks (two trailing spaces), `<` in the text, and blank lines at the end of the content.
const lungFunction: ExchangeTemplate = {
	content:
		'FEV1/FVC: {% info "fev1_fvc" type="number" unit="%" round=2 renderUnit=true /%}  \nTLC: {% info "tlc_abs" /%}\n\n',
	examples: ["FEV1/FVC: 81,02 %  \nTLC: 4,26 L", "## Beurteilung\n\n---\nKeine Obstruktion."],
	information: "### Obstruktion\n\n---\n\n- FEV1/FVC < 70 %\n\n---",
	title: 'Lungenfunktion: "Body" #1',
};

const bloodGas: ExchangeTemplate = {
	content: 'pH {% info "ph" /%}',
	examples: [],
	information: "",
	title: "BGA",
};

describe("template exchange format", () => {
	test("a template and a collection read back exactly", () => {
		expect(parseExchange(serializeTemplate(lungFunction))).toEqual({
			collection: null,
			entries: [{ ok: true, template: lungFunction }],
			problems: [],
		});

		const collection = { description: "Lunge: Funktion", title: "Pneumologie" };
		const text = serializeCollection(collection, [lungFunction, bloodGas]);
		expect(parseExchange(text)).toEqual({
			collection,
			entries: [
				{ ok: true, template: lungFunction },
				{ ok: true, template: bloodGas },
			],
			problems: [],
		});
		// Windows line endings from the clipboard do not change the content.
		expect(parseExchange(text.replaceAll("\n", "\r\n")).entries[0]).toEqual({
			ok: true,
			template: lungFunction,
		});
	});

	test("text cut off inside a collection keeps the complete templates", () => {
		const text = serializeCollection({ title: "Pneumologie" }, [bloodGas, lungFunction]);
		const cut = text.slice(0, text.indexOf("Keine Obstruktion."));
		const result = parseExchange(cut);

		expect(result.entries[0]).toEqual({ ok: true, template: bloodGas });
		expect(result.entries[1]).toMatchObject({ ok: false, title: lungFunction.title });
		expect(result.entries[1]?.ok === false && result.entries[1].error).toContain("abgeschnitten");
		expect(result.problems).toEqual(["Angekündigt: 2 Vorlagen, vollständig: 1."]);
	});

	test("a deleted closing marker fails only that template", () => {
		const text = serializeCollection({ title: "Pneumologie" }, [lungFunction, bloodGas]);
		const result = parseExchange(text.replace("<!-- /mdscribe:information -->\n", ""));

		expect(result.entries.map((entry) => entry.ok)).toEqual([false, true]);
	});

	test("export refuses content that would end a section early", () => {
		expect(() =>
			serializeTemplate({ ...bloodGas, content: "Text\n<!-- /mdscribe:content -->" }),
		).toThrow(ExchangeFormatError);
	});

	test("other text is not mistaken for a template", () => {
		expect(() => parseExchange("# Befund\n\nKeine Obstruktion.")).toThrow(ExchangeFormatError);
		expect(() => parseExchange("---\nmdscribe: template/v9\n---\n")).toThrow("Unbekanntes Format");
	});
});
