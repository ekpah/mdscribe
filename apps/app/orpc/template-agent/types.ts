import type { UIMessage } from "ai";

import type { AudioFile, FillInputsContextFile } from "@/orpc/scribe/types";

export interface TemplateSections {
	content: string;
	examples: string[];
	information: string;
}

export interface TemplateAgentChatInput extends TemplateSections {
	audioFiles?: AudioFile[];
	contextFiles?: FillInputsContextFile[];
	messages: UIMessage[];
}
