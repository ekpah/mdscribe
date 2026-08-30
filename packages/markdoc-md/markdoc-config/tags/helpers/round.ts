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
	return decimalPlaces === undefined ? value : Number(value.toFixed(decimalPlaces));
};
