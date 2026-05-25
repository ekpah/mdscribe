const REQUEST_PATH_HEADERS = [
	"x-mdscribe-path",
	"next-url",
	"x-url",
	"x-invoke-path",
	"x-matched-path",
	"x-pathname",
] as const;

const normalizePath = (input: string | null | undefined): string | null => {
	if (!input) {
		return null;
	}

	let value = input.trim();
	if (!value) {
		return null;
	}

	if (value.startsWith("http://") || value.startsWith("https://")) {
		try {
			const parsed = new URL(value);
			value = `${parsed.pathname}${parsed.search}${parsed.hash}`;
		} catch {
			return null;
		}
	}

	if (!value.startsWith("/")) {
		value = `/${value}`;
	}

	if (value.startsWith("//")) {
		return null;
	}

	if (value.startsWith("/sign-in")) {
		return null;
	}

	return value;
};

export const getSafeRedirectPath = (
	redirectPath: string | null | undefined,
	fallbackPath = "/dashboard",
): string => {
	const safePath = normalizePath(redirectPath);
	return safePath && safePath !== "/" ? safePath : fallbackPath;
};

export const createSignInRedirect = (redirectPath: string): string => {
	const safePath = getSafeRedirectPath(redirectPath);
	return `/sign-in?redirect=${encodeURIComponent(safePath)}`;
};

export const getRequestedPath = (
	requestHeaders: Headers,
	fallbackPath: string,
): string => {
	for (const headerName of REQUEST_PATH_HEADERS) {
		const headerPath = normalizePath(requestHeaders.get(headerName));
		if (headerPath) {
			return headerPath;
		}
	}

	return fallbackPath;
};
