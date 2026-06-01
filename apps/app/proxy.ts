import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const proxy = (request: NextRequest) => {
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-mdscribe-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
};

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
