/**
 * Generic document creation function using Langfuse prompt
 *
 * This module provides a reusable function for creating documents using
 * the "ai_scribe_template_completion" Langfuse prompt, including:
 * - Langfuse prompt integration
 * - AI model configuration and response generation
 * - Claude thinking mode configuration
 * - Usage logging and telemetry
 * - Error handling
 *
 * @example
 * // For streaming responses:
 * const result = await createDocument({
 *   input: { template: "discharge", patientData: {...} },
 *   userId: "user123",
 *   streaming: true
 * });
 *
 * @example
 * // For non-streaming responses:
 * const { text } = await createDocument({
 *   input: { template: "anamnese", patientData: {...} },
 *   userId: "user123",
 *   streaming: false
 * });
 */

import { type AnthropicProviderOptions, anthropic } from '@ai-sdk/anthropic';
import { database } from '@repo/database';
import { env } from '@repo/env';
import { type CoreMessage, generateText, streamText } from 'ai';
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();



export async function generateResponse({ patientData, template }: { patientData: Record<string, string | number | boolean>, template: string }) {

    // Get today's date for prompt compilation
    const todaysDate = new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    const modelConfig = {
        thinking: true,
        thinkingBudget: 12_000,
        maxTokens: 20_000,
        temperature: 0.3,
        streaming: true,
    };

    const chatPrompt = await langfuse.getPrompt('ai_scribe_template_completion', undefined, {
        type: 'chat',
        label: env.NODE_ENV === 'production' ? 'production' : 'staging',
    });

    const promptVariables = {
        ...patientData,
        template,
        todaysDate,
    };


    // Create streaming response
    const result = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        maxTokens: 20_000,
        temperature: 0.3,
        streaming: true,
        messages: chatPrompt.compile(promptVariables),
        onFinish: async (event) => {
            // Log usage in development
            if (env.NODE_ENV === 'development') {
                const logData = {
                    promptTokens: event.usage.promptTokens,
                    completionTokens: event.usage.completionTokens,
                    totalTokens: event.usage.totalTokens,
                    userId: userId || 'unknown',
                    promptName: 'ai_scribe_template_completion',
                    thinking: event.reasoning,
                    result: event.text,
                };
                // eslint-disable-next-line no-console
                console.log(logData);
            }

            // Log tokens to the postgres database for usage tracking
            await database.usageEvent.create({
                data: {
                    userId: userId || '',
                    totalTokens: event.usage.totalTokens,
                    name: 'ai_scribe_generation',
                }
            });
        },
    });

    return { stream: result.toDataStreamResponse().body };
}

// Create non-streaming response
const { text, usage } = await generateText(commonParams);

// Log usage in development
if (env.NODE_ENV === 'development') {
    const logData = {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        userId: userId || 'unknown',
        promptName: 'ai_scribe_template_completion',
    };
    // eslint-disable-next-line no-console
    console.log(logData);
}

// Log tokens to the postgres database for usage tracking
await database.usageEvent.create({
    data: {
        userId: userId || '',
        totalTokens: usage.totalTokens,
        name: 'ai_scribe_generation',
    }
});

return { text };
}