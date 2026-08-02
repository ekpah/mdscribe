const MAX_DIRECT_SUBSCRIPTION_PERIOD_MS = 45 * 24 * 60 * 60 * 1000;

export interface MonthlyUsagePeriod {
	end: Date;
	start: Date;
	type: "calendar" | "subscription";
}

const getDaysInUtcMonth = (year: number, month: number) =>
	new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const addUtcMonthsClamped = (anchor: Date, monthOffset: number) => {
	const targetMonthStart = new Date(
		Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 1),
	);
	const targetDay = Math.min(
		anchor.getUTCDate(),
		getDaysInUtcMonth(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth()),
	);

	return new Date(
		Date.UTC(
			targetMonthStart.getUTCFullYear(),
			targetMonthStart.getUTCMonth(),
			targetDay,
			anchor.getUTCHours(),
			anchor.getUTCMinutes(),
			anchor.getUTCSeconds(),
			anchor.getUTCMilliseconds(),
		),
	);
};

const getCalendarMonthPeriod = (now: Date): MonthlyUsagePeriod => ({
	end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
	start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
	type: "calendar",
});

export const resolveMonthlyUsagePeriod = (input: {
	hasActiveSubscription: boolean;
	now?: Date;
	subscriptionPeriodEnd?: Date | null;
	subscriptionPeriodStart?: Date | null;
}): MonthlyUsagePeriod => {
	const now = input.now ?? new Date();
	const anchor = input.subscriptionPeriodStart;

	if (!(input.hasActiveSubscription && anchor) || anchor.getTime() > now.getTime()) {
		return getCalendarMonthPeriod(now);
	}

	const subscriptionEnd = input.subscriptionPeriodEnd;
	const subscriptionPeriodDuration = subscriptionEnd
		? subscriptionEnd.getTime() - anchor.getTime()
		: null;

	if (
		subscriptionEnd &&
		subscriptionPeriodDuration !== null &&
		subscriptionPeriodDuration > 0 &&
		subscriptionPeriodDuration <= MAX_DIRECT_SUBSCRIPTION_PERIOD_MS &&
		now.getTime() < subscriptionEnd.getTime()
	) {
		return {
			end: subscriptionEnd,
			start: anchor,
			type: "subscription",
		};
	}

	let monthOffset =
		(now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
		(now.getUTCMonth() - anchor.getUTCMonth());
	let start = addUtcMonthsClamped(anchor, monthOffset);

	if (start.getTime() > now.getTime()) {
		monthOffset -= 1;
		start = addUtcMonthsClamped(anchor, monthOffset);
	}

	return {
		end: addUtcMonthsClamped(anchor, monthOffset + 1),
		start,
		type: "subscription",
	};
};
