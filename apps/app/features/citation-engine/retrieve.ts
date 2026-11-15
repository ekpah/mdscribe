import type { Claim } from "./claims";
import type { Passage } from "./passages";

const trigrams = (text: string) => {
	const padded = ` ${text.toLowerCase().replaceAll(/\s+/gu, " ")} `;
	const grams = new Set<string>();
	for (let index = 0; index < padded.length - 2; index += 1) {
		grams.add(padded.slice(index, index + 3));
	}
	return grams;
};

const similarity = (a: Set<string>, b: Set<string>) => {
	let shared = 0;
	for (const gram of a) {
		if (b.has(gram)) {
			shared += 1;
		}
	}
	return shared / Math.sqrt(a.size * b.size || 1);
};

/**
 * Per claim, the `k` lexically closest passages (indexes, best first). In the
 * benchmark trigram recall@3 was 98 % on literal facts and beat EmbeddingGemma 2
 * at every K, at no latency; it misses most interpreted facts.
 */
export const retrieveCandidates = (claims: Claim[], passages: Passage[], k: number): number[][] => {
	const passageGrams = passages.map((passage) => trigrams(passage.text));
	return claims.map((claim) => {
		const grams = trigrams(claim.text);
		return passageGrams
			.map((passage, index) => ({ index, score: similarity(grams, passage) }))
			.toSorted((a, b) => b.score - a.score)
			.slice(0, k)
			.map(({ index }) => index);
	});
};
