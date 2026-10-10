/* oxlint-disable eslint/no-await-in-loop, promise/avoid-new, typescript/no-non-null-assertion -- Imperative browser harness that polls the real DOM. */
import { analyzeMarkdocTemplate } from "markdoc-md/parse";
import React from "react";
import { createRoot } from "react-dom/client";

import Inputs from "../../app/_components/inputs/inputs";

/** Each scenario: a template, AI values that pick the shown cases, and the variable to focus. */
const scenarios = [
	{
		name: "a field repeated in both cases",
		source: `{% switch "mode" %}{% case "a" %}{% info "wert" /%}{% /case %}{% case "b" %}{% info "wert" /%}{% /case %}{% /switch %}`,
		suggestions: { mode: "b" },
		target: "wert",
	},
	{
		name: "a field inside a case and a calc",
		source: `{% switch "mode" %}{% case "on" %}{% info "gewicht" type="number" /%}{% /case %}{% /switch %}{% calc "bmi" formula="[gewicht]*2" /%}`,
		suggestions: { mode: "on" },
		target: "gewicht",
	},
	{
		name: "a calc inside a case used by another calc",
		source: `{% switch "mode" %}{% case "on" %}{% calc "SV" formula="2" /%}{% /case %}{% /switch %}{% calc "PAC" formula="[SV]+1" /%}`,
		suggestions: { mode: "on" },
		target: "SV",
	},
	{
		name: "an info mirroring a calc inside a case",
		source: `{% info "t" type="number" /%}{% switch "mode" %}{% case "on" %}{% calc "t" formula="3" /%}{% /case %}{% /switch %}`,
		suggestions: { mode: "on" },
		target: "t",
	},
];

const sleep = (milliseconds: number) =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

const wait = async (test: () => boolean, message: string) => {
	for (let index = 0; index < 100; index += 1) {
		if (test()) {
			return;
		}
		await sleep(30);
	}
	throw new Error(message);
};

const run = async () => {
	for (const scenario of scenarios) {
		const element = document.createElement("div");
		document.body.append(element);
		const root = createRoot(element);
		const { inputs } = analyzeMarkdocTemplate(scenario.source);
		const suggestedValues = Object.fromEntries(
			Object.entries(scenario.suggestions).map(([key, value]) => [
				key,
				{ source: "ai" as const, value },
			]),
		);
		const render = (focusKey?: number) =>
			root.render(
				<Inputs
					activeInputFocusKey={focusKey}
					activeInputName={focusKey === undefined ? undefined : scenario.target}
					inputTags={inputs}
					onChange={() => {}}
					suggestedValues={suggestedValues}
				/>,
			);
		render();
		await wait(() => element.querySelectorAll("input").length > 0, `${scenario.name}: no inputs`);
		await sleep(50);
		render(1);
		await wait(() => {
			const focused = document.activeElement;
			if (!(focused instanceof HTMLInputElement) || !element.contains(focused)) {
				return false;
			}
			const label = element.querySelector(`label[for="${focused.id}"]`)?.textContent?.trim();
			return label === scenario.target;
		}, `${scenario.name}: focusing ${scenario.target} did not reach its input`);
		root.unmount();
		element.remove();
	}
};

const report = async () => {
	try {
		await run();
		document.body.dataset.testResult = "passed";
		document.body.textContent =
			"Focusing a variable reaches a shown mention in every case and calc scenario";
	} catch (error) {
		document.body.dataset.testResult = "failed";
		document.body.textContent =
			error instanceof Error ? (error.stack ?? error.message) : String(error);
	}
};

void report();
