import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { voiceFillHandler } from "@/orpc/scribe/voiceFill";
import {
	createMockSession,
	createTestContext,
	createTestUser,
	startTestServer,
	type TestServer,
} from "../setup";

describe("Scribe voiceFill Handler", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("voicefill-test");
	});

	afterEach(async () => {
		await server.close();
	});

	test("returns fieldValues for valid input", async () => {
		const { user } = await createTestUser(server.db);
		const session = createMockSession(user);
		const context = createTestContext({ db: server.db, session });

		const result = await call(
			voiceFillHandler,
			{
				inputFields: [
					{
						label: "Field 1",
						description: "",
					},
				],
				audioFiles: [
					{
						data: Buffer.from("test").toString("base64"),
						mimeType: "audio/wav",
					},
				],
			},
			{ context },
		);

		expect(result).toBeDefined();
		expect(result.fieldValues).toBeDefined();
		expect(result.fieldValues.test).toBe("value");
	});
});
