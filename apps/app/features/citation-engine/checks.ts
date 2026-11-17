// Transcripts spell numbers out ("fünf Milligramm"); the index is the value.
const NUMBER_WORDS = "null ein zwei drei vier fünf sechs sieben acht neun zehn elf zwölf".split(
	" ",
);
const TENS = "zwanzig dreißig vierzig fünfzig sechzig siebzig achtzig neunzig".split(" ");
const numberTokens = (text: string) => text.match(/\d+(?:[.,:/]\d+)*/gu) ?? [];

/**
 * Every number of a claim must occur in its evidence. Decision models passed
 * wrong values and invented dates in the benchmark; without this check 3–9 of
 * 39 planted errors were cited. Accepts "4.78" for "4,78" (OCR decimal points),
 * "05.11.2026" as "11/2026" and German number words.
 */
export const isNumericallyGrounded = (claim: string, evidence: string) => {
	const decimals = evidence.replaceAll(/(\d)\.(\d)/gu, "$1,$2");
	const known = new Set(
		[...numberTokens(evidence), ...numberTokens(decimals)].flatMap((token) => {
			const date = /^(\d{1,2})[.,](\d{1,2})[.,](\d{4})$/u.exec(token);
			return date
				? [
						token,
						`${date[1]}.${date[2]}.${date[3]}`,
						`${date[2]}/${date[3]}`,
						`${date[2].padStart(2, "0")}/${date[3]}`,
					]
				: [token];
		}),
	);
	for (const word of evidence.toLowerCase().match(/[a-zäöüß]+/gu) ?? []) {
		const value = NUMBER_WORDS.indexOf(word.replace(/^ein(?:e[mnrs]?|s)$/u, "ein"));
		const tens = TENS.indexOf(word);
		if (value !== -1) {
			known.add(String(value));
		}
		if (tens !== -1) {
			known.add(String((tens + 2) * 10));
		}
	}
	return numberTokens(claim).every(
		(token) =>
			known.has(token) ||
			known.has(token.replaceAll(".", ",")) ||
			decimals.includes(token) ||
			evidence.includes(token),
	);
};

/**
 * In "BGA bei Aufnahme (14.11.2026): pH 7,12" an ungrounded label (here an
 * invented date) would drop the whole citation. Returns the offset of the part
 * after the last ": " when that part alone is grounded, else null.
 */
export const groundedAfterLabel = (claim: string, evidence: string): number | null => {
	const colon = claim.lastIndexOf(": ");
	return colon !== -1 && isNumericallyGrounded(claim.slice(colon + 2), evidence) ? colon + 2 : null;
};

/** Lower case with umlauts spelled out, as OCR often writes them ("Haemoglobin"). */
const fold = (text: string) =>
	text
		.toLowerCase()
		.replaceAll("ä", "ae")
		.replaceAll("ö", "oe")
		.replaceAll("ü", "ue")
		.replaceAll("ß", "ss");

const STOP_WORDS = new Set(
	fold("aktuell beim bislang durch eine einem einer eines nach ohne seit sowie unter über").split(
		" ",
	),
);

/**
 * Share of the claim's content words (first five letters, so "Pneumonie" matches
 * "Pneumonien") and numbers that occur in the evidence. A conclusion such as "Akutes Delir"
 * cited with "zunehmende Verwirrtheit" shares none; claims without such words count as covered.
 * Numbers count because a lab line such as "NT-proBNP: 4200 pg/ml" is mostly its value.
 */
export const wordCoverage = (claim: string, evidence: string) => {
	const stems = (fold(claim).match(/[a-z]{4,}/gu) ?? [])
		.filter((word) => !STOP_WORDS.has(word))
		.map((word) => word.slice(0, 5));
	const numbers = numberTokens(claim);
	const text = fold(evidence);
	const covered =
		stems.filter((stem) => text.includes(stem)).length +
		numbers.filter((number) => isNumericallyGrounded(number, evidence)).length;
	const total = stems.length + numbers.length;
	return total ? covered / total : 1;
};

/** Markdown emphasis or code split by a citation boundary would change rendering. */
export const isSafeAnchor = (text: string) =>
	!/\{%|%\}|\n|\]\(/u.test(text) &&
	[/\*/gu, /_/gu, /`/gu].every((marker) => (text.match(marker)?.length ?? 0) % 2 === 0);
