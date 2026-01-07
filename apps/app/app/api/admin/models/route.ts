import { env } from "@repo/env";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { allowAdminAccess } from "@/flags";

export interface OpenRouterModel {
	id: string;
	name: string;
	description?: string;
	context_length: number;
	architecture: {
		modality: string;
		tokenizer: string;
		instruct_type?: string;
	};
	pricing: {
		prompt: string;
		completion: string;
		image?: string;
		request?: string;
	};
	top_provider?: {
		context_length?: number;
		max_completion_tokens?: number;
		is_moderated?: boolean;
	};
	per_request_limits?: {
		prompt_tokens?: string;
		completion_tokens?: string;
	};
}

export interface OpenRouterModelsResponse {
	data: OpenRouterModel[];
}

// Parse modality string to get input/output capabilities
export function parseModality(modality: string): {
	supportsText: boolean;
	supportsImage: boolean;
	supportsAudio: boolean;
	supportsVideo: boolean;
	outputsText: boolean;
	outputsImage: boolean;
	outputsAudio: boolean;
} {
	// Modality format: "input1+input2->output1+output2" (e.g., "text+image->text")
	const [input, output] = modality.split("->");
	const inputs = input?.toLowerCase() || "";
	const outputs = output?.toLowerCase() || "";

	return {
		supportsText: inputs.includes("text"),
		supportsImage: inputs.includes("image"),
		supportsAudio: inputs.includes("audio"),
		supportsVideo: inputs.includes("video"),
		outputsText: outputs.includes("text"),
		outputsImage: outputs.includes("image"),
		outputsAudio: outputs.includes("audio"),
	};
}

export async function GET() {
	// Check authentication
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Check admin access
	const hasAdminAccess = await allowAdminAccess();
	if (!hasAdminAccess) {
		return new Response("Forbidden", { status: 403 });
	}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/models", {
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			},
			next: {
				revalidate: 3600, // Cache for 1 hour
			},
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data: OpenRouterModelsResponse = await response.json();

		// Transform and sort models - prioritize popular providers
		const priorityProviders = [
			"anthropic",
			"openai",
			"google",
			"meta-llama",
			"mistralai",
			"cohere",
			"deepseek",
			"qwen",
		];

		const sortedModels = data.data.sort((a, b) => {
			const aProvider = a.id.split("/")[0];
			const bProvider = b.id.split("/")[0];
			const aIndex = priorityProviders.indexOf(aProvider);
			const bIndex = priorityProviders.indexOf(bProvider);

			if (aIndex !== -1 && bIndex !== -1) {
				return aIndex - bIndex;
			}
			if (aIndex !== -1) return -1;
			if (bIndex !== -1) return 1;
			return a.name.localeCompare(b.name);
		});

		// Add parsed modality info
		const modelsWithCapabilities = sortedModels.map((model) => ({
			...model,
			capabilities: parseModality(model.architecture?.modality || "text->text"),
		}));

		return Response.json({ data: modelsWithCapabilities });
	} catch (error) {
		console.error("Failed to fetch models from OpenRouter:", error);
		return new Response(
			`Failed to fetch models: ${error instanceof Error ? error.message : "Unknown error"}`,
			{ status: 500 },
		);
	}
}
