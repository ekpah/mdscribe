import type {
	InputContextAudioFile,
	InputContextTextContext,
} from "@/app/_components/input-context/types";
import type { RawContextDocument } from "@/lib/ocr-types";
import type { PromptHarnessId } from "@/orpc/scribe/prompts";

export type ContextTransferTargetType = "ai-form" | "document" | "template" | "workspace";

export interface TransferAudioFile extends InputContextAudioFile {
	duration?: number;
	sourceDeviceLabel?: string;
}

export interface ContextTransferPayload {
	audioFiles: TransferAudioFile[];
	contextFiles: RawContextDocument[];
	source?: {
		promptHarness?: PromptHarnessId | string;
		title?: string;
	};
	textContext: InputContextTextContext;
	version: 1;
}
