/**
 * Better Auth client methods resolve with an error result for non-2xx responses
 * instead of rejecting. Convert that result into normal promise failure
 * semantics before passing it to toast.promise or running success-only logic.
 */
export const unwrapAuthClientResult = <TResult extends { data?: unknown; error?: unknown }>(
	result: TResult,
): TResult["data"] => {
	if (result.error) {
		throw result.error;
	}

	return result.data;
};
