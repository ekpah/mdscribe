import type { UIMessage } from "ai";

import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

export interface TemplateAgentChatInput {
	audioFiles?: AudioFile[];
	content: string;
	contextFiles?: FillInputsContextFile[];
	messages: UIMessage[];
}
