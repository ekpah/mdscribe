/* oxlint-disable eslint/complexity, eslint/no-plusplus, eslint/no-promise-executor-return, eslint/no-void, eslint/require-await, import/no-named-as-default-member, promise/avoid-new, promise/prefer-await-to-callbacks, typescript/no-non-null-assertion, unicorn/consistent-function-scoping, unicorn/prefer-query-selector -- Imperative browser harness that polls the real DOM and counts Markdoc calls. */
import Markdoc from "@markdoc/markdoc";
import { analyzeMarkdocTemplate } from "markdoc-md/parse";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import Inputs from "../../app/_components/inputs/inputs";

const source = `{% calc "score" formula="[a]+[b]" round=2 %}{% info "a" type="number" /%}{% info "b" type="number" /%}{% /calc %}{% info "aiField" /%}{% condition ["x","y"] %}{% case gt=[11,null] %}FIRST_BRANCH{% /case %}{% case gt=[null,14] %}SECOND_BRANCH{% /case %}{% case default=true %}FALLBACK_BRANCH{% /case %}{% /condition %}`;
const regressionSource = `{% info "hiddenTotal" type="number" /%}{% switch "gate" %}{% case "show" %}{% calc "hiddenTotal" formula="5" /%}{% /case %}{% /switch %}{% calc "aiScore" formula="2" /%}{% calc "n" formula="1" /%}{% calc "double" formula="[score]*2" /%}{% switch "detailsMode" %}{% case "on" %}{% condition "n" %}{% case gt=0 %}{% info "detail" /%}{% /case %}{% /condition %}{% /case %}{% /switch %}`;
const { inputs } = analyzeMarkdocTemplate(source + regressionSource);
type Suggestions = Record<string, { source: "ai"; value: string | number }>;
const initialSuggestions: Suggestions = {
	aiField: { source: "ai", value: "recognized" },
	aiScore: { source: "ai", value: 9 },
};
let publication: Record<string, unknown> = {};
let fillResponse: FillResponse = {};
let fillFailure = false;
let submittedFields: { calculation?: unknown; label: string }[] = [];
type FillResponse = Record<string, boolean | number | string>;
let parses = 0;
let transforms = 0;
const { parse } = Markdoc;
const { transform } = Markdoc;
Markdoc.parse = (...args) => {
	parses++;
	return parse(...args);
};
Markdoc.transform = new Proxy(transform, {
	apply(target, thisArg, args) {
		transforms++;
		return Reflect.apply(target, thisArg, args);
	},
});

const Harness = () => {
	const [values, setValues] = useState<Record<string, unknown>>({});
	publication = values;
	return (
		<>
			<Inputs
				inputTags={inputs}
				onChange={setValues}
				onInputSelect={() => {}}
				suggestedValues={initialSuggestions}
				showFillInputs
				onFillInputs={async (fields) => {
					submittedFields = fields;
					if (fillFailure) {
						throw new Error("expected failure");
					}
					return fillResponse;
				}}
				renderFillControls={({ onSubmit }) => (
					<button type="button" onClick={() => void onSubmit([], {}, [])}>
						Autofill
					</button>
				)}
			/>
			<div id="document-result">
				<DynamicMarkdocRenderer markdocContent={source + regressionSource} variables={values} />
			</div>
		</>
	);
};
const element = document.createElement("div");
document.body.append(element);
let renderFailure: unknown;
const root = createRoot(element, {
	onUncaughtError: (error) => {
		renderFailure = error;
	},
});
root.render(<Harness />);
const waitFor = async (test: () => boolean, message: string) => {
	for (let index = 0; index < 100; index++) {
		if (renderFailure) {
			throw renderFailure;
		}
		if (test()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
	throw new Error(`${message}: ${JSON.stringify(publication)}`);
};
const control = (name: string) => {
	const label = [...element.querySelectorAll("label")].find(
		(item) => item.textContent?.trim() === name,
	);
	return label ? (document.getElementById(label.htmlFor) as HTMLInputElement | null) : null;
};
const write = async (name: string, value: string) => {
	await waitFor(() => !!control(name), `missing control ${name}`);
	const input = control(name)!;
	input.focus();
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
	input.blur();
	await waitFor(
		() => Number(publication[name]) === Number(value),
		`value not published: ${name}=${value}`,
	);
};
const click = (text: string) => {
	const button = [...element.querySelectorAll("button")].find(
		(item) => item.textContent?.trim() === text || item.getAttribute("aria-label") === text,
	);
	if (!button) {
		throw new Error(`missing button ${text}`);
	}
	button.click();
};

void (async () => {
	await waitFor(() => !!control("score"), "initial inputs unavailable");
	const initialCounts = [parses, transforms];
	await waitFor(() => publication.hiddenTotal === 5, "hidden calculation was not global");
	await write("hiddenTotal", "7");
	control("score")!.focus();
	control("score")!.blur();
	await write("a", "3");
	// A calculation waits for all of its values and shows a placeholder meanwhile.
	await waitFor(
		() =>
			publication.score === undefined &&
			control("score")?.value === "" &&
			control("score")?.placeholder === "…" &&
			!element.textContent?.includes("NaN"),
		"incomplete calculation was not left empty",
	);
	await write("b", "0");
	await waitFor(() => publication.score === 3, "focus/blur created an accidental override");
	if (!submittedFields.length) {
		fillResponse = { aiField: "first", aiScore: 13, score: 8 };
		click("Autofill");
		await waitFor(() => publication.aiField === "first", "autofill did not publish AI values");
	}
	const scoreMetadata = submittedFields.find((field) => field.label === "score");
	if (!scoreMetadata?.calculation) {
		throw new Error("calc metadata was not merged by field name");
	}
	if (publication.aiScore !== 13 || publication.score !== 8) {
		throw new Error("AI values did not override calculated values");
	}
	if (publication.hiddenTotal !== 7) {
		throw new Error("info override of hidden calc lost");
	}
	await write("a", "0");

	// A manual value has highest priority and survives later fills.
	await write("score", "9");
	fillResponse = { aiScore: 17 };
	click("Autofill");
	await waitFor(() => publication.aiScore === 17, "second autofill did not replace AI values");
	if (Number(publication.score) !== 9) {
		throw new Error("autofill replaced a manual override");
	}
	if (publication.aiField !== undefined) {
		throw new Error("omitted prior AI value survived autofill");
	}

	// Clearing only the manual layer reveals the calculation because the latest fill omitted score.
	const score = control("score")!;
	score.focus();
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(score, "");
	score.dispatchEvent(new Event("input", { bubbles: true }));
	score.dispatchEvent(new Event("change", { bubbles: true }));
	score.blur();
	await waitFor(
		() => publication.score === 0,
		"clearing manual override did not reveal calculation",
	);

	// Failed requests preserve the previous AI layer.
	fillFailure = true;
	click("Autofill");
	await new Promise((resolve) => setTimeout(resolve, 50));
	if (Number(publication.aiScore) !== 17) {
		throw new Error("failed autofill cleared previous AI values");
	}
	fillFailure = false;
	await write("aiScore", "2");
	fillResponse = { aiScore: 23, hiddenTotal: 11 };
	click("Autofill");
	await new Promise((resolve) => setTimeout(resolve, 60));
	if (Number(publication.aiScore) !== 2) {
		throw new Error("manual value equal to formula was not retained");
	}
	for (const name of ["aiScore", "hiddenTotal"]) {
		const input = control(name)!;
		input.focus();
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "");
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
		input.blur();
	}
	await waitFor(
		() => publication.aiScore === 23 && publication.hiddenTotal === 11,
		"clearing manual calc/info did not reveal latest AI",
	);
	fillResponse = {};
	click("Autofill");
	await waitFor(
		() => publication.aiScore === 2 && publication.hiddenTotal === 5,
		"AI omission did not restore calculations",
	);

	// Emptying an AI-filled ordinary field keeps it empty instead of reviving the suggestion.
	fillResponse = { aiField: "again" };
	click("Autofill");
	await waitFor(() => publication.aiField === "again", "autofill did not refill aiField");
	const aiField = control("aiField")!;
	aiField.focus();
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(aiField, "");
	aiField.dispatchEvent(new Event("input", { bubbles: true }));
	aiField.dispatchEvent(new Event("change", { bubbles: true }));
	aiField.blur();
	await waitFor(() => publication.aiField === "", "emptied AI field was revived");
	// A later autofill still fills a field the user emptied.
	fillResponse = { aiField: "third", aiScore: 30 };
	click("Autofill");
	await waitFor(
		() => publication.aiField === "third" && publication.aiScore === 30,
		"autofill skipped an emptied field",
	);
	// Without a manual value, resetting a calc drops its AI suggestion and calculates again.
	click("KI-Vorschlag verwerfen");
	await waitFor(() => publication.aiScore === 2, "AI suggestion of a calc could not be reset");

	// A calc component that is calculated elsewhere links to its calculation instead of an input.
	const reference = element.querySelector<HTMLButtonElement>(
		'button[aria-label="score – ursprüngliche Berechnung öffnen"]',
	);
	if (!reference?.textContent?.includes("berechnet")) {
		throw new Error("nested calc reference is missing");
	}
	if (publication.double !== Number(publication.score) * 2) {
		throw new Error("dependent calc did not use the referenced result");
	}
	// The mirrored control overrides the referenced calculation itself.
	const mirrored = reference.parentElement?.querySelector("input") as HTMLInputElement;
	mirrored.focus();
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(mirrored, "21");
	mirrored.dispatchEvent(new Event("input", { bubbles: true }));
	mirrored.dispatchEvent(new Event("change", { bubbles: true }));
	mirrored.blur();
	await waitFor(
		() => publication.score === 21 && publication.double === 42,
		"mirrored calc control did not override the calculation",
	);
	if (!reference.parentElement?.parentElement?.textContent?.includes("Überschrieben")) {
		throw new Error("mirrored calc control does not show the override");
	}
	click("Manuelle Überschreibung entfernen");

	await write("x", "12");
	await write("y", "15");
	const result = () => document.querySelector("#document-result")!.textContent!;
	if (!result().includes("FIRST_BRANCH") || result().includes("SECOND_BRANCH")) {
		throw new Error("first match not exclusive");
	}
	await write("x", "8");
	if (!result().includes("SECOND_BRANCH") || result().includes("FIRST_BRANCH")) {
		throw new Error("second member not reactive");
	}
	click("on");
	await waitFor(() => !!control("detail"), "computed switch lost nested detail input");
	// A condition on a calc inside a case mirrors the calc instead of adding a plain input.
	if (!element.querySelector('button[aria-label="n – ursprüngliche Berechnung öffnen"]')) {
		throw new Error("condition on a calc added an independent number input");
	}
	await write("n", "0");
	await waitFor(() => !control("detail"), "condition did not hide nested input");
	if (parses !== initialCounts[0] || transforms !== initialCounts[1]) {
		throw new Error("value edits reparsed or retransformed Markdoc");
	}
	root.unmount();
	Markdoc.parse = parse;
	Markdoc.transform = transform;
	document.body.dataset.testResult = "passed";
	document.body.textContent =
		"Global calculations, independent user/AI layers, replacement autofill, metadata merging, nested visibility, reactive vectors and zero parse/transform on edits passed";
})().catch((error) => {
	document.body.dataset.testResult = "failed";
	document.body.textContent =
		error instanceof Error ? (error.stack ?? error.message) : String(error);
});
