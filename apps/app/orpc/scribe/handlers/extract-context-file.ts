import { ORPCError } from "@orpc/server";
import { aiDefaults, eq } from "@repo/database";
import { z } from "zod";

import { FILL_INPUT_PAYLOAD_LIMITS, getBase64DecodedByteLength } from "@/lib/input-fill-limits";
import { authed } from "@/orpc";
import { scribeEntitlementsMiddleware } from "@/orpc/middlewares/entitlements";
import { extractContextFiles } from "@/orpc/scribe/handlers/context-file-input";
import { enforceScribeUsageLimit } from "@/orpc/scribe/handlers/usage-limit";
import { resolveOcrSelection } from "@/orpc/scribe/providers";

const isSupported = (mimeType: string) =>
	mimeType === "application/pdf" || mimeType.startsWith("image/");

export const documentInputPolicyHandler = authed.handler(async ({ context }) => {
	const [defaults] = await context.db
		.select({
			agentSupportsDocuments: aiDefaults.defaultAgentSupportsDocuments,
			ocrModelId: aiDefaults.defaultFileImageModelId,
			standardSupportsAgent: aiDefaults.defaultStandardSupportsAgent,
			supportsDocuments: aiDefaults.defaultStandardSupportsDocuments,
		})
		.from(aiDefaults)
		.where(eq(aiDefaults.id, "global"));
	const supportsDocuments = defaults?.supportsDocuments ?? false;
	return {
		// Mirrors resolveAgentGenerationStrategy: the agent uses the standard model when it covers agents.
		agentSupportsDocuments: defaults?.standardSupportsAgent
			? supportsDocuments
			: (defaults?.agentSupportsDocuments ?? false),
		ocrConfigured: Boolean(defaults?.ocrModelId),
		supportsDocuments,
	};
});

export const extractContextFileHandler = authed
	.use(scribeEntitlementsMiddleware)
	.input(
		z.object({
			file: z.object({
				data: z
					.string()
					.max(Math.ceil((FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes * 4) / 3) + 1024),
				mimeType: z.string(),
				name: z.string().max(1024),
				size: z.number().nonnegative(),
			}),
		}),
	)
	.handler(async ({ input, context }) => {
		const bytes = getBase64DecodedByteLength(input.file.data);
		if (!isSupported(input.file.mimeType) || bytes === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Nur Bilder und PDF-Dateien können analysiert werden.",
			});
		}
		if (bytes > FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes) {
			throw new ORPCError("BAD_REQUEST", { message: "Die Datei ist zu groß." });
		}
		const selection = await resolveOcrSelection(context.db, context.session.user.id);
		const { entitlements } = await enforceScribeUsageLimit({
			db: context.db,
			entitlements: context.entitlements.scribe,
			isQuotaExempt: selection.model.credentialSource === "user_byok",
			session: context.session,
		});
		const extracted = await extractContextFiles({
			contextFiles: [input.file],
			db: context.db,
			modelSelection: selection,
			userId: context.session.user.id,
			zdr: entitlements.hasActiveSubscription,
		});
		const [result] = extracted.ocrResults;
		if (!result) {
			throw new ORPCError("BAD_REQUEST", { message: "OCR lieferte kein Ergebnis." });
		}
		return { result };
	});
