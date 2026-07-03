interface WeeklyUsageBucket {
	bucket: string;
	requests: number;
}

export interface WeeklyUsageProjection {
	bucket: string;
	requests: number;
}

const WEEK_LENGTH_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getLocalDate = (now: Date, timeZone: string): Date => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(now);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

	return new Date(
		Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
	);
};

const toBucket = (date: Date): string =>
	`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
		date.getUTCDate(),
	).padStart(2, "0")}T00:00:00`;

export const getCurrentWeekUsageProjection = (
	weeklyUsage: WeeklyUsageBucket[],
	timeZone: string,
	now = new Date(),
): WeeklyUsageProjection | null => {
	const localDate = getLocalDate(now, timeZone);
	const daysSinceMonday = (localDate.getUTCDay() + 6) % WEEK_LENGTH_DAYS;
	const currentWeekStart = new Date(localDate);
	currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - daysSinceMonday);
	const bucket = toBucket(currentWeekStart);
	const currentWeek = weeklyUsage.find((week) => week.bucket === bucket);

	if (!currentWeek) {
		return null;
	}

	const elapsedDays = Math.floor((localDate.getTime() - currentWeekStart.getTime()) / DAY_IN_MS) + 1;
	return {
		bucket,
		requests: Math.round((currentWeek.requests / elapsedDays) * WEEK_LENGTH_DAYS),
	};
};
