import type { ContextBlock, ContextBuildInput } from "./types";
import { patientContextProvider } from "./providers/patient";
import { templateContextProvider } from "./providers/template";
import { userContextProvider } from "./providers/user";
import { renderContextXml } from "./render";

const providers = [
	patientContextProvider,
	templateContextProvider,
	userContextProvider,
];

export async function buildScribeContext(
	input: ContextBuildInput,
): Promise<{ blocks: ContextBlock[]; contextXml: string }> {
	const blocks = (
		await Promise.all(
			providers.map((provider) => provider.build(input)),
		)
	).filter((block): block is ContextBlock => Boolean(block));

	return {
		blocks,
		contextXml: renderContextXml(blocks),
	};
}
