import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "@repo/env";
import { generateObject, generateText } from "ai";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { parsePDFFormFields } from "@/app/documents/_lib/parsePDFFormFields";
import type { FieldMapping } from "@/app/documents/_lib/parsePDFFormFields";
import z from "zod";

export async function POST(req: Request) {
	try {
		// Authenticate user
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Parse FormData
		const formData = await req.formData();
		const file = formData.get("file") as File | null;
		const fieldMappingStr = formData.get("fieldMapping") as string | null;

		if (!file) {
			return Response.json({ error: "File is required" }, { status: 400 });
		}

		if (!fieldMappingStr) {
			return Response.json(
				{ error: "Field mapping is required" },
				{ status: 400 },
			);
		}

		// Parse field mapping JSON
		let fieldMapping: Record<string, FieldMapping>;
		try {
			fieldMapping = JSON.parse(fieldMappingStr);
		} catch {
			return Response.json(
				{ error: "Invalid field mapping format" },
				{ status: 400 },
			);
		}

		// Convert File to Uint8Array and base64 data URL
		const arrayBuffer = await file.arrayBuffer();
		const fileBytes = new Uint8Array(arrayBuffer);
		const base64File = Buffer.from(fileBytes).toString("base64");
		const dataUrl = `data:application/pdf;base64,${base64File}`;

		// Create prompt for Gemini to enhance field mappings
		const prompt = `You are analyzing a PDF form document. I've extracted the following form field mappings from the PDF:

${JSON.stringify(fieldMapping, null, 2)}

For each field mapping, please:
1. Suggest a better, more descriptive label (using camelCase)
2. Provide a clear, concise description of what this field is for

Return your response as a JSON object with this exact structure:
{
  "fieldMapping": [{
    "fieldName": "[original_field_name]",
    "label": "[enhanced_label]",
    "description": "[clear description of the field]"
  }]
}

Make sure to:
- Keep all original fieldName values
- Use camelCase for labels (e.g., "firstName", "emailAddress")
- Make descriptions concise but informative
- Preserve the fieldName exactly as shown in the input`;

		// Initialize OpenRouter with Gemini 2.5 Pro
		const openrouter = createOpenRouter({
			apiKey: env.OPENROUTER_API_KEY as string,
		});

		const model = openrouter("google/gemini-2.5-flash");

		// Generate enhanced field mappings using Gemini
		// Note: Gemini 2.5 Pro supports PDFs via OpenRouter, but we'll send it as base64
		// For now, we'll enhance based on field mappings and field information
		const { object } = await generateObject({
			model,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: prompt,
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "file",
							data: dataUrl,
							mediaType: "application/pdf",
						},
					],
				},
			],
			temperature: 0.3,
			schema: z.object({
				fieldMapping: z.array(
					z.object({
						fieldName: z.string(),
						label: z.string(),
						description: z.string(),
					}),
				),
			}),
		});
		return Response.json(object);
	} catch (error) {
		console.error("Error enhancing PDF form fields:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		return Response.json(
			{ error: `Failed to enhance form fields: ${errorMessage}` },
			{ status: 500 },
		);
	}
}
