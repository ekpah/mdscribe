import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	getBase64DecodedByteLength,
	getBase64Payload,
} from "@/lib/input-fill-limits";
import { AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { locateDocumentQuotes } from "@/orpc/scribe/citations/locate-quote";
import { contextFileUploadSchema } from "@/orpc/scribe/handlers/extract-context-file";
import { logMediaPreprocessingUsage } from "@/orpc/scribe/handlers/preprocessing-usage";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import {
	isGenerationStrategyFullyByok,
	resolveDecisionModel,
	resolveGenerationStrategy,
} from "@/orpc/scribe/providers";

/** Locates all cited quotes of one document at once; `null` where a quote is not found. */
export const resolveDocumentCitationsHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(
		z.object({
			file: contextFileUploadSchema,
			quotes: z.array(z.string().trim().min(1).max(4000)).min(1).max(100),
		}),
	)
	.handler(async ({ input, context, signal }) => {
		const bytes = getBase64DecodedByteLength(input.file.data);
		if (
			!(input.file.mimeType === "application/pdf" || input.file.mimeType.startsWith("image/")) ||
			bytes === 0 ||
			bytes > FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes
		) {
			throw new ORPCError("BAD_REQUEST", { message: "Die Quelldatei ist ungültig oder zu groß." });
		}
		const userId = context.session.user.id;
		const [provider, strategy] = await Promise.all([
			resolveDecisionModel(context.db, userId).catch(() => null),
			resolveGenerationStrategy(context.db, { hasFiles: true, userId }).catch(() => null),
		]);
		// Without a usable decision model the original page is shown without a highlight.
		// As in autofill, fully BYOK users never send documents to an operator-paid model.
		// Locating quotes needs box questions, which only OpenRouter's Decisions API answers.
		if (
			provider?.protocol !== "openrouter" ||
			!strategy ||
			(isGenerationStrategyFullyByok(strategy) && provider.credentialSource !== "user_byok")
		) {
			return input.quotes.map(() => null);
		}
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			isQuotaExempt: provider.credentialSource === "user_byok",
			session: context.session,
		});
		const budget = AbortSignal.timeout(60_000);
		let started = Date.now();
		try {
			return await locateDocumentQuotes({
				data: Buffer.from(getBase64Payload(input.file.data), "base64"),
				mimeType: input.file.mimeType,
				onUsage: ({ model, usage }) => {
					// Each page request is timed separately.
					const timeToCompletionMs = Date.now() - started;
					started = Date.now();
					logMediaPreprocessingUsage({
						db: context.db,
						isOpenRouter: true,
						metadata: {
							credentialSource: provider.credentialSource,
							promptName: "citation:locate-quote",
							providerId: provider.providerId,
							providerProtocol: "openrouter",
						},
						modelName: model,
						name: AI_SCRIBE_OCR_EVENT_NAME,
						providerMetadata: {
							openrouter: {
								usage: {
									completionTokens: usage.output_tokens,
									cost: usage.cost,
									promptTokens: usage.input_tokens,
									totalTokens: usage.input_tokens + usage.output_tokens,
								},
							},
						},
						timing: { timeToCompletionMs },
						userId: context.session.user.id,
						zdr: entitlements.hasActiveSubscription,
					});
				},
				quotes: input.quotes,
				signal: signal ? AbortSignal.any([signal, budget]) : budget,
				target: provider,
			});
		} catch {
			// File decoders and network errors may embed patient data or credentials.
			console.warn("Citation location failed", { model: provider.modelId });
			throw new ORPCError("BAD_REQUEST", {
				message: "Die Quellenmarkierung ist derzeit nicht verfügbar.",
			});
		}
	});
