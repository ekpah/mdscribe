export type RoundValue = number | false;

const isValidDecimalPlaces = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

export const roundNumber = (
	value: number,
	round: RoundValue | undefined,
	defaultDecimalPlaces?: number,
): number => {
	if (round === false) {
		return value;
	}

	const decimalPlaces = isValidDecimalPlaces(round) ? round : defaultDecimalPlaces;
	if (decimalPlaces === undefined) {
		return value;
	}
	// Shifting by exponent avoids binary artifacts (5.55 is stored as 5.5499…),
	// so halves round away from zero like on paper.
	const shifted = Math.round(Number(`${Math.abs(value)}e${decimalPlaces}`));
	const rounded = Math.sign(value) * Number(`${shifted}e-${decimalPlaces}`);
	return Number.isFinite(rounded) ? rounded : Number(value.toFixed(decimalPlaces));
};
