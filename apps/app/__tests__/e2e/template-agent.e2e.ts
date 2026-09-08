import { os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { expect, test } from "@playwright/test";

test.use({ viewport: { height: 1000, width: 1600 } });

test("agent updates sections independently and tag clicks reopen Info without edit focus changes", async ({
	page,
}) => {
	await page.goto("/sign-in");
	await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await page.getByLabel("Passwort", { exact: true }).fill("password123");
	await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/templates/create");
	await page.getByRole("button", { exact: true, name: "Info" }).click();
	await page.getByLabel("Variablenname", { exact: true }).fill("patient");
	const agentTab = page.getByRole("tab", { exact: true, name: "Agent" });
	const infoTab = page.getByRole("tab", { exact: true, name: "Info" });
	for (let click = 0; click < 2; click += 1) {
		await agentTab.click();
		await page.locator('button[data-type="markdoc-info"]').click();
		await expect(infoTab).toHaveAttribute("aria-selected", "true");
	}
	await agentTab.click();
	await page.getByRole("tab", { exact: true, name: "Informationen" }).click();
	await page.locator("#template-information").fill("Original\n\nGuidance");
	await expect(page.locator("#template-information")).toBeFocused();
	await expect(agentTab).toHaveAttribute("aria-selected", "true");

	const updates = [
		{ examples: ["First\nSecond"] },
		{ information: "New\n\nGuidance" },
		{ examples: [], information: "" },
	];
	const requests: { content: string; examples: string[]; information: string }[] = [];
	await page.route("**/api/rpc/templateAgent/edit", async (route) => {
		requests.push(route.request().postDataJSON().json);
		const output = { ...updates[requests.length - 1], ok: true };
		const handler = new RPCHandler({
			templateAgent: {
				edit: os.handler(async function* edit() {
					yield { messageId: `message-${requests.length}`, type: "start" };
					yield {
						input: updates[requests.length - 1],
						toolCallId: `call-${requests.length}`,
						toolName: "updateTemplate",
						type: "tool-input-available",
					};
					yield { output, toolCallId: `call-${requests.length}`, type: "tool-output-available" };
					yield { finishReason: "stop", type: "finish" };
				}),
			},
		});
		const { response } = await handler.handle(
			new Request(route.request().url(), {
				body: route.request().postData(),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
			{ prefix: "/api/rpc" },
		);
		if (!response) {
			throw new Error("Missing mock RPC response");
		}
		await route.fulfill({
			body: await response.text(),
			headers: Object.fromEntries(response.headers),
			status: response.status,
		});
	});
	for (let index = 0; index < updates.length; index += 1) {
		await page.getByLabel("Anweisung an den Template Agent").fill("Update requested section");
		await page.getByRole("button", { name: "Änderung anwenden" }).click();
		await expect(page.getByText("Vorlage im Editor aktualisiert", { exact: true })).toHaveCount(
			index + 1,
		);
	}
	expect(requests[0]?.content).toContain("patient");
	expect(requests[0]?.information).toBe("Original\n\nGuidance");
	expect(requests[1]?.examples).toEqual(["First\nSecond"]);
	expect(requests[1]?.information).toBe("Original\n\nGuidance");
	expect(requests[2]?.information).toBe("New\n\nGuidance");
	expect(requests[2]?.content).toBe(requests[0]?.content);
	await expect(page.locator("#template-information")).toHaveValue("");
	await page.getByRole("tab", { exact: true, name: "Beispiele" }).click();
	await expect(page.getByText("Noch keine Beispiele hinzugefügt.")).toBeVisible();
});
