import type {
	DocumentType,
	DocumentTypeConfig,
} from "@/orpc/scribe/types";
import { documentPromptDefinitions } from "./definitions";

const exposedPromptHarnessDocumentTypes = [
	"discharge",
	"anamnese",
	"diagnosis",
	"procedures",
	"befunde",
	"outpatient",
	"icu-transfer",
] as const satisfies DocumentType[];

export type PromptHarnessId =
	(typeof documentPromptDefinitions)[(typeof exposedPromptHarnessDocumentTypes)[number]]["promptName"];

export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> =
	documentPromptDefinitions;

export const PROMPT_HARNESS_IDS = exposedPromptHarnessDocumentTypes.map(
	(documentType) => documentTypeConfigs[documentType].promptName,
) as PromptHarnessId[];

export const getDocumentTypeByPromptName = (
	promptName: string,
): DocumentType | undefined => {
	const entry = Object.entries(documentTypeConfigs).find(
		([_, config]) => config.promptName === promptName,
	);
	return entry?.[0] as DocumentType | undefined;
};
