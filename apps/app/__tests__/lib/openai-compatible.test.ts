import { describe, expect, test } from "bun:test";
import {
	normalizeOpenAICompatibleBaseUrl,
	normalizeProviderBaseUrl,
	PROVIDER_BASE_URL_ERROR_MESSAGE,
} from "@/lib/openai-compatible";

describe("normalizeProviderBaseUrl", () => {
	test("adds http scheme when omitted and strips trailing slash", () => {
		expect(normalizeProviderBaseUrl("localhost:11434/")).toBe(
			"http://localhost:11434",
		);
	});

	test("keeps a path and strips trailing slashes", () => {
		expect(normalizeProviderBaseUrl("https://example.com/custom/path///")).toBe(
			"https://example.com/custom/path",
		);
	});

	test("rejects query and hash in base URL", () => {
		expect(() =>
			normalizeProviderBaseUrl("https://example.com/v1/?foo=bar"),
		).toThrow(PROVIDER_BASE_URL_ERROR_MESSAGE);
		expect(() =>
			normalizeProviderBaseUrl("https://example.com/v1/#anchor"),
		).toThrow(PROVIDER_BASE_URL_ERROR_MESSAGE);
	});
});

describe("normalizeOpenAICompatibleBaseUrl", () => {
	test("normalizes trailing slash and appends /v1 when missing", () => {
		expect(normalizeOpenAICompatibleBaseUrl("http://localhost:11434/")).toBe(
			"http://localhost:11434/v1",
		);
	});

	test("normalizes /v1/ to /v1", () => {
		expect(normalizeOpenAICompatibleBaseUrl("http://localhost:11434/v1/")).toBe(
			"http://localhost:11434/v1",
		);
	});
});
