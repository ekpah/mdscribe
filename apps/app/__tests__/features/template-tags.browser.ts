// Browser regression (real DOMParser): the app's tags survive the template editor's round-trip.
// bun build __tests__/features/template-tags.browser.ts --target browser --format=iife --outfile /tmp/template-tags.js
// agent-browser eval --stdin < /tmp/template-tags.js
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";

import { appMarkdocConfig } from "../../features/template-tags/config";
import { templateTagRenderers } from "../../features/template-tags/editor/renderers";

const roundTrip = (source: string) =>
	htmlToMarkdoc(renderTipTapHTML(source, { config: appMarkdocConfig }), {
		renderers: templateTagRenderers,
	});

for (const source of [
	// A block instruction stays one instruction around both paragraphs.
	"Vorher\n\n{% ai %}\nErster Absatz\n\nZweiter Absatz\n\n{% /ai %}\n\nNachher\n\n",
	// A letter of sections stays as written, including tags inside the sections.
	'{% section id="diagnosen" title="Diagnosen" %}\n{% ai %}Hauptdiagnose{% /ai %}\n\n{% /section %}\n\n{% section id="anamnese" title="Anamnese" %}\nNikotin: {% info "Packungsjahre" type="number" /%}\n\n{% details summary="Vorbefunde" %}\nText\n\n{% /details %}\n\n{% /section %}\n\n',
	// Inside a switch case too.
	'{% switch "s" %}{% case "a" %}A {% ai %}kurz{% /ai %}{% /case %}{% /switch %}\n\n',
]) {
	const actual = roundTrip(source);
	if (actual !== source) {
		throw new Error(`Expected ${JSON.stringify(source)}, received ${JSON.stringify(actual)}`);
	}
}
