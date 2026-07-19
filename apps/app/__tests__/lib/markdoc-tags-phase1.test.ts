import { describe, expect, test } from "bun:test";

import parseMarkdocToInputs from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { validateMarkdocTagContracts } from "@repo/markdoc-md/parse/validate-markdoc-tag-contracts";

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

	test("allows compatible repeated info tags and fills optional metadata", () => {
		const source = `
{% info "Gewicht" type="number" /%}
{% info "Gewicht" type="number" unit="kg" description="Körpergewicht" renderUnit=true /%}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);
		if (input?.name !== "Info") {
			throw new Error("Expected info input");
		}

		expect(diagnostics).toEqual([]);
		expect(input?.attributes).toMatchObject({
			description: "Körpergewicht",
			primary: "Gewicht",
			type: "number",
			unit: "kg",
		});
		expect(input?.attributes.renderUnit).toBe(false);
	});

	test("normalizes omitted tag types before comparing repeated inputs", () => {
		const compatibleInfo = validateMarkdocTagContracts(`
{% info "Name" /%}
{% info "Name" type="string" /%}
`);
		const conflictingInfo = validateMarkdocTagContracts(`
{% info "Alter" /%}
{% info "Alter" type="number" /%}
`);
		const compatibleSwitch = validateMarkdocTagContracts(`
{% switch "Aktiv" type="checkbox" %}{% case "true" %}Ja{% /case %}{% /switch %}
{% switch "Aktiv" type="boolean" %}{% case "false" %}Nein{% /case %}{% /switch %}
`);

		expect(compatibleInfo).toEqual([]);
		expect(compatibleSwitch).toEqual([]);
		expect(conflictingInfo).toHaveLength(1);
		expect(conflictingInfo[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{
					attribute: "type",
					conflictingValue: "number",
					firstValue: "string",
				},
			],
			primary: "Alter",
			tag: "info",
		});
	});

	test("reports every conflicting info setting with source locations", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% info "Gewicht" type="number" unit="kg" description="Erstes Feld" /%}
{% info "Gewicht" type="date" unit="cm" description="Zweites Feld" /%}
`);

		expect(diagnostics).toHaveLength(1);
		const [diagnostic] = diagnostics;
		expect(diagnostic).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{ attribute: "type", conflictingValue: "date", firstValue: "number" },
				{ attribute: "unit", conflictingValue: "cm", firstValue: "kg" },
				{
					attribute: "description",
					conflictingValue: "Zweites Feld",
					firstValue: "Erstes Feld",
				},
			],
			primary: "Gewicht",
			tag: "info",
		});
		if (diagnostic?.code !== "tag-settings-conflict") {
			throw new Error("Expected settings conflict");
		}
		expect(diagnostic.conflictingLocation?.start.line).toBeDefined();
		expect(diagnostic.conflicts.every((conflict) => conflict.firstLocation)).toBe(true);
	});

	test("rejects input tags of different kinds that share a primary", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% info "Status" /%}
{% switch "Status" %}{% case "A" %}A{% /case %}{% /switch %}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-kind-conflict",
			conflictingTag: "switch",
			firstTag: "info",
			primary: "Status",
		});
	});

	test("allows repeated switches to union cases when their types agree", () => {
		const source = `
{% switch "Status" %}{% case "A" %}A{% /case %}{% /switch %}
{% switch "Status" type="string" %}{% case "B" %}B{% /case %}{% /switch %}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);

		expect(diagnostics).toEqual([]);
		expect(input?.children.map((child) => child.attributes.primary)).toEqual(["A", "B"]);
	});

	test("reports conflicting switch types", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% switch "Status" type="string" %}{% case "A" %}A{% /case %}{% /switch %}
{% switch "Status" type="boolean" %}{% case "true" %}Ja{% /case %}{% /switch %}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [{ attribute: "type", conflictingValue: "boolean", firstValue: "string" }],
			primary: "Status",
			tag: "switch",
		});
	});

	test("keeps score presentation local and rejects conflicting formulas", () => {
		const compatible = validateMarkdocTagContracts(`
{% score "BMI" formula="[A]+1" unit="kg" renderUnit=false /%}
{% score "BMI" formula="[A]+1" unit="cm" renderUnit=true /%}
`);
		const conflictingSource = `
{% score "Total" formula="[A]+1" /%}
{% score "Total" formula="[B]+2" /%}
`;
		const conflicting = validateMarkdocTagContracts(conflictingSource);
		const [score] = parseMarkdocToInputs(conflictingSource);
		if (score?.name !== "Score") {
			throw new Error("Expected score input");
		}

		expect(compatible).toEqual([]);
		expect(conflicting).toHaveLength(1);
		expect(conflicting[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [{ attribute: "formula", conflictingValue: "[B]+2", firstValue: "[A]+1" }],
			primary: "Total",
			tag: "score",
		});
		expect(score?.attributes.formula).toBe("[A]+1");
		expect(score?.children.map((child) => child.attributes.primary)).toEqual(["A"]);
	});

	test("keeps formula-only scores valid and separate", () => {
		const source = `
{% score formula="[A]+1" /%}
{% score formula="[B]+2" /%}
`;

		expect(validateMarkdocTagContracts(source)).toEqual([]);
		expect(parseMarkdocToInputs(source)).toHaveLength(2);
	});
});
