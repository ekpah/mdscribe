import { describe, expect, test } from "bun:test";

import { NextRequest } from "next/server";

import {
	createSignInRedirect,
	getRequestedPath,
	getSafeRedirectPath,
} from "@/lib/sign-in-redirect";
import { proxy } from "@/proxy";

describe("sign-in redirects", () => {
	test("uses the stamped request path including query parameters", () => {
		const headers = new Headers({
			"x-mdscribe-path": "/admin/settings/models?tab=forms",
		});

		expect(getRequestedPath(headers, "/admin")).toBe("/admin/settings/models?tab=forms");
		expect(createSignInRedirect(getRequestedPath(headers, "/admin"))).toBe(
			"/sign-in?redirect=%2Fadmin%2Fsettings%2Fmodels%3Ftab%3Dforms",
		);
	});

	test("proxy stamps the current path for server guards", () => {
		const response = proxy(
			new NextRequest("https://mdscribe.test/admin/settings/models?tab=forms"),
		);

		expect(response.headers.get("x-middleware-request-x-mdscribe-path")).toBe(
			"/admin/settings/models?tab=forms",
		);
	});

	test("falls back when no request path header is available", () => {
		expect(getRequestedPath(new Headers(), "/admin")).toBe("/admin");
	});

	test("does not treat referer as the requested protected path", () => {
		const headers = new Headers({
			referer: "/dashboard",
		});

		expect(getRequestedPath(headers, "/admin")).toBe("/admin");
	});

	test("sanitizes redirect parameters used by the sign-in page", () => {
		expect(getSafeRedirectPath("/admin/settings/models")).toBe("/admin/settings/models");
		expect(getSafeRedirectPath("/")).toBe("/dashboard");
		expect(getSafeRedirectPath("https://example.com/admin")).toBe("/admin");
		expect(getSafeRedirectPath("//example.com/admin")).toBe("/dashboard");
		expect(getSafeRedirectPath("/sign-in?redirect=%2Fadmin")).toBe("/dashboard");
	});
});
