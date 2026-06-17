import { ORPCError, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { generateText } from "ai";
import { z } from "zod";

import { AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import { buildUsageEventData, extractOpenRouterUsage } from "@/lib/usage-logging";
import type { StandardUsage } from "@/lib/usage-logging";
import { authed } from "@/orpc";
import { requiredAdminMiddleware } from "@/orpc/middlewares/admin";
import { SCRIBE_OCR_TO_MARKDOWN_PROMPT } from "@/orpc/scribe/prompts/core/ocr-to-markdown";
import { buildProviderOptions, resolveProviderModel } from "@/orpc/scribe/providers";

const ocrImageInput = z.object({
	data: z.string().min(1),
	mediaType: z.string().min(1).refine((value) => value.startsWith("image/"), {
		message: "mediaType muss ein Bild-MIME-Type sein",
	}),
});

const ocrToMarkdownInput = z.object({
	// Backward compatibility while frontend payload migrates fully.
	connectionId: z.string().min(1).optional(),
	fileBase64: z.string().min(1).optional(),
	images: z.array(ocrImageInput).optional(),
	imagesBase64: z.array(z.string().min(1)).optional(),
	model: z.string().min(1),
	// undefined = Standard-Prompt, null = ohne Prompt, string = eigener Prompt.
	prompt: z.string().max(8000).nullable().optional(),
	providerId: z.string().min(1).optional(),
});

const stripCodeFence = (markdown: string): string => {
	const trimmed = markdown.trim();
	const fencedMatch = trimmed.match(/^```(?:md|markdown)?\n([\s\S]*?)\n```$/i);
	if (!fencedMatch) {
		return trimmed;
	}
	return fencedMatch[1]?.trim() ?? "";
};

type OcrInput = z.infer<typeof ocrToMarkdownInput>;
type OcrImageInput = z.infer<typeof ocrImageInput>;
type OcrContentPart =
	| { type: "text"; text: string }
	| { type: "image"; image: Uint8Array; mediaType: string }
	| { type: "file"; data: Uint8Array; mediaType: string };

const normalizeImageInputs = (input: OcrInput): OcrImageInput[] =>
	input.images ??
	input.imagesBase64?.map((data) => ({
		data,
		mediaType: "image/jpeg",
	})) ??
	[];

const requireProviderId = (input: OcrInput): string => {
	const providerId = input.providerId ?? input.connectionId;
	if (!providerId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "providerId fehlt",
		});
	}
	return providerId;
};

const resolvePromptText = (prompt: OcrInput["prompt"]): string | null =>
	prompt === null ? null : prompt?.trim() || SCRIBE_OCR_TO_MARKDOWN_PROMPT;

const buildOcrContent = (
	input: OcrInput,
	imageInputs: OcrImageInput[],
	promptText: string | null,
): {
	fileSizeBytes: number;
	fileType: "images" | "pdf";
	pageCount: number | undefined;
	userContent: OcrContentPart[];
} => {
	const userContent: OcrContentPart[] = promptText
		? [{ text: promptText, type: "text" }]
		: [];

	if (imageInputs.length > 0) {
		let fileSizeBytes = 0;
		for (const imageInput of imageInputs) {
			const bytes = new Uint8Array(Buffer.from(imageInput.data, "base64"));
			fileSizeBytes += bytes.length;
			userContent.push({
				image: bytes,
				mediaType: imageInput.mediaType,
				type: "image",
			});
		}
		return {
			fileSizeBytes,
			fileType: "images",
			pageCount: imageInputs.length,
			userContent,
		};
	}

	if (!input.fileBase64) {
		throw new ORPCError("BAD_REQUEST", {
			message: "fileBase64 oder images muss angegeben werden",
		});
	}
	const bytes = new Uint8Array(Buffer.from(input.fileBase64, "base64"));
	userContent.push({
		data: bytes,
		mediaType: "application/pdf",
		type: "file",
	});
	return {
		fileSizeBytes: bytes.length,
		fileType: "pdf",
		pageCount: undefined,
		userContent,
	};
};

export const ocrToMarkdownHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<z.infer<typeof ocrToMarkdownInput>>())
	.handler(async ({ input, context }) => {
		const parsed = ocrToMarkdownInput.parse(input);
		const imageInputs = normalizeImageInputs(parsed);

		if (!parsed.fileBase64 && imageInputs.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "fileBase64 oder images muss angegeben werden",
			});
		}

		const providerId = requireProviderId(parsed);
		const resolvedModel = await resolveProviderModel(providerId, parsed.model, context.db);
		const promptText = resolvePromptText(parsed.prompt);
		const { fileSizeBytes, fileType, pageCount, userContent } = buildOcrContent(
			parsed,
			imageInputs,
			promptText,
		);

		let result: Awaited<ReturnType<typeof generateText>>;
		const requestStartedAt = Date.now();
		try {
			result = await generateText({
				experimental_telemetry: { isEnabled: true },
				maxOutputTokens: 24_000,
				messages: [{ content: userContent, role: "user" }],
				model: resolvedModel.model,
				providerOptions: buildProviderOptions({
					includeUsage: true,
					model: resolvedModel,
					userId: context.session.user.id,
				}),
				temperature: 0,
			});
		} catch (error) {
			const details = error instanceof Error ? error.message : "Unbekannter Fehler";
			throw new ORPCError("BAD_REQUEST", {
				message: `OCR fehlgeschlagen. Bitte ein OCR-fähiges Modell wählen. (${details})`,
			});
		}
		const timeToCompletionMs = Date.now() - requestStartedAt;

		const openRouterUsage = resolvedModel.isOpenRouter
			? extractOpenRouterUsage(
					(result as { providerMetadata?: Record<string, unknown> }).providerMetadata,
				)
			: null;
		const markdown = stripCodeFence(result.text);
		const promptName = promptText ? "ocr:prompt" : "ocr:direct";

		await context.db.insert(usageEvent).values(
			buildUsageEventData({
				inputData: {
					fileSizeBytes,
					fileType,
					pageCount,
				},
				metadata: {
					endpoint: promptName,
					promptLabel: promptName,
					promptName,
					providerId,
				},
				model: resolvedModel.modelName,
				name: AI_SCRIBE_OCR_EVENT_NAME,
				openRouterUsage,
				result: markdown,
				standardUsage: result.usage as StandardUsage,
				timing: { timeToCompletionMs },
				userId: context.session.user.id,
			}),
		);

		return { markdown };
	});
