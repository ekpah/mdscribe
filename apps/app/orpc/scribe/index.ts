import { anthropic } from '@ai-sdk/anthropic';
import { streamToEventIterator } from '@orpc/server';
import { env } from '@repo/env';
import { type ModelMessage, streamText } from 'ai';
import Langfuse from 'langfuse';
import z from 'zod';
import { authed } from '@/orpc';

const ScribeInputSchema = z.object({
    anamnese: z.string().optional(),
    vordiagnosen: z.string().optional(),
    diagnoseblock: z.string().optional(),
    befunde: z.string().optional(),
});

const langfuse = new Langfuse();

const defaultTemplate = `

[Primäres Problem und Vorstellungsgrund](erläutere das primäre Problem des Patienten bzw. die klinische Verdachtsdiagnose und ordne den Vorstellungskontext ein)
[Unterstützende Anamnese](erläutere die Historie und weitere Informationen, die zur Beurteilung des primären Problems beitragen)

Vitalparameter:
[Vitalparameter des Patienten](füge die Vitalparameter des Patienten ein, wenn sie vorliegen. Lasse dies ansonsten frei)

[ToDo:](leave out, if no todos relevant)
-[Investigations planned for Issue 1(include only if applicable and if mentioned)]
-[Treatment planned for Issue 1(include only if applicable and if mentioned)]
-[Relevant referrals for Issue 1(include only if applicable and if mentioned)]
-[Follow up plan(noting timeframe if stated or applicable and if mentioned)]
-[Safety netting advice given(for example, if mentioned, state which symptoms would mean they need to call back GP OR call 111(non - life threatening) for out of hours GP or if deteriorates to attend A & E / call 999 in life - threatening emergency(include only the advice / options which are mentioned in transcript or contextual notes))]

(Never come up with your own patient details, assessment, diagnosis, differential diagnosis, plan, interventions, evaluation, plan for continuing care, safety netting advice, etc - use only the transcript, contextual notes or clinical note as a reference for the information you include in your note.If any information related to a placeholder has not been explicitly mentioned in the transcript or contextual notes, you must not state the information has not been explicitly mentioned in your output, just leave the relevant placeholder or section blank.) (Use as many sentences as needed to capture all the relevant information from the transcript and contextual notes.)`;

export const scribeHandler = authed
    .input(ScribeInputSchema)

    .handler(async ({ input, context }) => {
        // Get today's date for prompt compilation
        const todaysDate = new Date().toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const chatPrompt = await langfuse.getPrompt(
            'ai_scribe_template_completion',
            undefined,
            {
                type: 'chat',
                label: env.NODE_ENV === 'production' ? 'production' : 'staging',
            }
        );

        const promptVariables = {
            ...input,
            template: defaultTemplate,
            todaysDate,
        };

        const promptMessages = chatPrompt.compile(
            promptVariables
        ) as ModelMessage[];

        // Create streaming response
        const result = streamText({
            model: anthropic('claude-sonnet-4-20250514'),
            providerOptions: {
                anthropic: {
                    thinking: { type: 'enabled', budgetTokens: 12_000 },
                },
            },
            maxOutputTokens: 20_000,
            temperature: 0.3,
            messages: promptMessages as ModelMessage[],
            onFinish: async (event) => {
                // Log usage in development
                if (env.NODE_ENV === 'development') {
                    const logData = {
                        promptTokens: event.usage.inputTokens,
                        completionTokens: event.usage.outputTokens,
                        totalTokens: event.usage.totalTokens,
                        userId: context.session.user.id || 'unknown',
                        promptName: 'ai_scribe_template_completion',
                        thinking: event.reasoning,
                        result: event.text,
                    };
                    // biome-ignore lint/suspicious/noConsole: log here as it is only for development
                    console.log(logData);
                }

                // Log tokens to the postgres database for usage tracking
                await context.db.usageEvent.create({
                    data: {
                        userId: context.session.user.id || '',
                        totalTokens: event.usage.totalTokens,
                        name: 'ai_scribe_generation',
                    },
                });
            },
        });

        return streamToEventIterator(result.toUIMessageStream());
    });
