import type {
	InputContextAudioFile,
	InputContextFile,
	InputContextTextContext,
} from "@/app/_components/input-context/types";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

export type ContextTransferTargetType = "ai-form" | "document" | "template";

export interface TransferAudioFile extends InputContextAudioFile {
	duration?: number;
	sourceDeviceLabel?: string;
}

export interface ContextTransferPayload {
	audioFiles: TransferAudioFile[];
	contextFiles: InputContextFile[];
	source?: {
		promptHarness?: PromptHarnessId | string;
		title?: string;
	};
	textContext: InputContextTextContext;
	version: 1;
}

