import { describe, expect, test } from "bun:test";

import parseMarkdocToInputs from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

describe("markdoc tags phase 1 regressions", () => {
	test("keeps case scopes separate across switches with same case labels", () => {
		const source = `
{% switch "S1" %}{% case "Ja" %}{% info "I1" /%}{% /case %}{% /switch %}
{% switch "S2" %}{% case "Ja" %}{% info "I2" /%}{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const switchS1 = tags.find((tag) => tag.name === "Switch" && tag.attributes.primary === "S1");
		const switchS2 = tags.find((tag) => tag.name === "Switch" && tag.attributes.primary === "S2");

		expect(switchS1).toBeDefined();
		expect(switchS2).toBeDefined();
		expect(switchS1?.children).toHaveLength(1);
		expect(switchS2?.children).toHaveLength(1);
		expect(switchS1?.children[0]?.children[0]?.attributes.primary).toBe("I1");
		expect(switchS2?.children[0]?.children[0]?.attributes.primary).toBe("I2");
	});

	test("merges repeated switch definitions by primary and retains all cases", () => {
		const source = `
{% switch "Status" %}{% case "A" %}{% info "I1" /%}{% /case %}{% /switch %}
{% switch "Status" %}{% case "B" %}{% info "I2" /%}{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const switches = tags.filter(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Status",
		);
		const [mergedSwitch] = switches;

		expect(switches).toHaveLength(1);
		expect(mergedSwitch?.children.map((child) => child.attributes.primary)).toEqual(["A", "B"]);
	});

	test("preserves boolean switch type when parsing and merging", () => {
		const source = `
	{% switch "Raucher" %}{% case "true" %}Ja{% /case %}{% /switch %}
	{% switch "Raucher" type="boolean" %}{% case "false" %}Nein{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const smokerSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Raucher",
		);

		if (!smokerSwitch || smokerSwitch.name !== "Switch") {
			throw new Error("Expected smoker switch");
		}
		expect(smokerSwitch.attributes.type).toBe("boolean");
		expect(smokerSwitch?.children.map((child) => child.attributes.primary)).toEqual([
			"true",
			"false",
		]);
	});

	test("normalizes legacy switch type=checkbox to type=boolean", () => {
		const source = `
	{% switch "Antikoagulation" type="checkbox" %}{% case "true" %}Ja{% /case %}{% case "false" %}Nein{% /case %}{% /switch %}
	`;

		const tags = parseMarkdocToInputs(source);
		const anticoagulationSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Antikoagulation",
		);

		if (!anticoagulationSwitch || anticoagulationSwitch.name !== "Switch") {
			throw new Error("Expected anticoagulation switch");
		}

		expect(anticoagulationSwitch.attributes.type).toBe("boolean");
	});

	test("keeps formula-only score tags distinct and collects all variables", () => {
		const source = `
{% score formula="[A]+[B]" /%}
{% score formula="[C]+[D]" /%}
`;

		const tags = parseMarkdocToInputs(source);
		const scoreTags = tags.filter((tag) => tag.name === "Score");
		const referencedVariables = scoreTags.flatMap((scoreTag) =>
			scoreTag.children.map((childTag) => childTag.attributes.primary),
		);

		expect(scoreTags).toHaveLength(2);
		expect(new Set(referencedVariables)).toEqual(new Set(["A", "B", "C", "D"]));
	});

	test("does not leak nested case tags into outer switches", () => {
		const source = `
{% switch "outer" %}
{% case "x" %}
{% switch "inner" %}
{% case "y" %}{% info "I1" /%}{% /case %}
{% /switch %}
{% /case %}
{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const outerSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "outer",
		);
		const outerCase = outerSwitch?.children[0];
		const innerSwitch = outerCase?.children.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "inner",
		);

		expect(outerSwitch?.children.map((child) => child.attributes.primary)).toEqual(["x"]);
		expect(innerSwitch).toBeDefined();
		expect(innerSwitch?.children.map((child) => child.attributes.primary)).toEqual(["y"]);
	});
});
