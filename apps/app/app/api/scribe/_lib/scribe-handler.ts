/**
 * Reusable API handler for scribe routes
 *
 * This module provides a reusable handler that abstracts common functionality
 * for all scribe API routes, including:
 * - Authentication and subscription checking
 * - Input validation and processing
 * - Langfuse prompt integration
 * - AI model configuration and response generation
 * - Claude thinking mode configuration (disabled by default)
 * - Usage logging and telemetry
 * - Error handling
 *
 * @example
 * // For streaming responses (default):
 * const handleAnamnese = createScribeHandler({
 *   promptName: 'ER_Anamnese_chat',
 *   validateInput: createInputValidator(['prompt']),
 *   processInput: (input) => {
 *     const { prompt } = input as { prompt: string };
 *     const parsed = JSON.parse(prompt);
 *     return { anamnese: parsed.anamnese, vordiagnosen: parsed.vordiagnosen };
 *   },
 *   modelConfig: {
 *     thinking: true, // Enable thinking (default: false)
 *     thinkingBudget: 8000,
 *   },
 * });
 *
 * @example
 * // For non-streaming responses:
 * const handleDiagnosis = createScribeHandler({
 *   promptName: 'ER_Diagnose_chat',
 *   streaming: false,
 *   validateInput: createInputValidator(['prompt']),
 *   processInput: (input) => {
 *     const { prompt } = input as { prompt: string };
 *     const parsed = JSON.parse(prompt);
 *     return { anamnese: parsed.anamnese };
 *   },
 *   modelConfig: {
 *     maxTokens: 2000,
 *     temperature: 0,
 *     thinking: false, // Disable thinking (default)
 *   },
 * });
 *
 * @example
 * // Usage in API route:
 * export const POST = handleAnamnese;
 */

import { type AnthropicProviderOptions, anthropic } from '@ai-sdk/anthropic';
import { fireworks } from '@ai-sdk/fireworks';
import { google } from '@ai-sdk/google';
import { database } from '@repo/database';
import { env } from '@repo/env';
import {
  type CoreMessage,
  generateText,
  type LanguageModel,
  streamText,
} from 'ai';
import { Langfuse } from 'langfuse';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { authClient } from '@/lib/auth-client';
import type { Session } from '@/lib/auth-types';
import { getUsage } from './get-usage';

const langfuse = new Langfuse();

// Supported models type
type SupportedModel = 'glm-4p5' | 'claude-sonnet-4.5' | 'gemini-2.5-pro';

// Model configuration mapper
function getModelConfig(modelId: string): {
  model: LanguageModel;
  supportsThinking: boolean;
} {
  switch (modelId as SupportedModel) {
    case 'glm-4p5':
      return {
        model: fireworks('accounts/fireworks/models/glm-4p5'),
        supportsThinking: false,
      };
    case 'claude-sonnet-4.5':
      return {
        model: anthropic('claude-sonnet-4-5'),
        supportsThinking: true,
      };
    case 'gemini-2.5-pro':
      return {
        model: google('gemini-2.5-pro'),
        supportsThinking: false,
      };
    default:
      // Default to Claude if unknown model
      return {
        model: anthropic('claude-sonnet-4-5'),
        supportsThinking: true,
      };
  }
}

interface ScribeHandlerConfig {
  // Langfuse prompt configuration
  promptName: string;
  promptLabel?: string;

  // Input validation and processing
  validateInput: (input: unknown) => { isValid: boolean; error?: string };
  processInput: (
    input: unknown
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;

  // Response configuration
  streaming?: boolean; // Default: true

  // AI model configuration
  modelConfig?: {
    maxTokens?: number;
    temperature?: number;
    thinking?: boolean; // Default: false
    thinkingBudget?: number;
  };

  // Custom metadata for telemetry
  getMetadata?: (
    input: unknown,
    userId: string
  ) => Record<string, string | number | boolean>;
}

async function checkAuthAndSubscription() {
  const { data: subscriptions } = await authClient.subscription.list();

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { usage } = await getUsage(session as Session);

  const usageLimit = activeSubscription ? 500 : 50;

  if (usage?.count >= usageLimit) {
    return new Response(
      'Monatliche Nutzungsgrenze erreicht - passe dein Abonnement an',
      { status: 403 }
    );
  }

  return { session, activeSubscription, usage };
}

async function getLangfusePrompt(promptName: string, promptLabel?: string) {
  const textPrompt = await langfuse.getPrompt(promptName, undefined, {
    type: 'chat',
    label:
      promptLabel || (env.NODE_ENV === 'production' ? 'production' : 'staging'),
  });

  return textPrompt;
}

async function processRequest(
  config: ScribeHandlerConfig,
  requestBody: unknown
) {
  // Validate input
  const validation = config.validateInput(requestBody);
  if (!validation.isValid) {
    return { error: validation.error || 'Invalid input', status: 400 };
  }

  // Extract model and audio from request body (default to claude-sonnet-4)
  const requestObj = requestBody as Record<string, unknown>;
  const model = (requestObj.model as string) || 'claude-sonnet-4';
  const audio = requestObj.audio as string | undefined;
  const audioMimeType = requestObj.audioMimeType as string | undefined;

  // Process input data
  const processedInput = await config.processInput(requestBody);

  // Get today's date for prompt compilation
  const todaysDate = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return { processedInput, todaysDate, model, audio, audioMimeType };
}

async function generateResponse(
  config: ScribeHandlerConfig,
  messages: CoreMessage[],
  metadata: Record<string, string | number | boolean>,
  session: Session,
  modelId: string,
  audio?: string,
  audioMimeType?: string
) {
  // Default model configuration
  const defaultModelConfig = {
    maxTokens: 20_000,
    temperature: 1,
    thinking: false, // Default: false
    thinkingBudget: 8000,
  };

  const modelConfig = { ...defaultModelConfig, ...config.modelConfig };

  // Get the model and its capabilities
  const { model, supportsThinking } = getModelConfig(modelId);

  // Build provider options conditionally (only for models that support thinking)
  const providerOptions: AnthropicProviderOptions = {};
  if (modelConfig.thinking && supportsThinking) {
    providerOptions.thinking = {
      type: 'enabled',
      budgetTokens: modelConfig.thinkingBudget,
    };
  }

  // If audio is provided, add it to the messages
  let messagesWithAudio = messages;
  if (audio && audioMimeType && modelId === 'gemini-2.5-pro') {
    // Add audio to the user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      messagesWithAudio = [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: [
            {
              type: 'text' as const,
              text: typeof lastMessage.content === 'string' ? lastMessage.content : '',
            },
            {
              type: 'file' as const,
              data: audio,
              mimeType: audioMimeType,
            },
          ],
        },
      ];
    }
  }

  // Common model parameters
  const commonParams = {
    model,
    maxTokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
    experimental_telemetry: {
      isEnabled: true,
      metadata,
    },
    providerOptions: supportsThinking
      ? {
          anthropic: providerOptions,
        }
      : undefined,
    messages: messagesWithAudio,
  };

  // Handle streaming vs non-streaming responses
  const useStreaming = config.streaming !== false; // Default to true

  if (useStreaming) {
    // Create streaming response
    const result = streamText({
      ...commonParams,
      onFinish: async (event) => {
        // Log usage in development
        if (env.NODE_ENV === 'development') {
          const logData = {
            promptTokens: event.usage.inputTokens,
            completionTokens: event.usage.outputTokens,
            totalTokens: event.usage.totalTokens,
            userId: session?.user?.id || 'unknown',
            promptName: config.promptName,
            thinking: event.reasoning,
            result: event.text,
          };
          console.log(logData);
        }

        // Log tokens to the postgres database for usage tracking
        await database.usageEvent.create({
          data: {
            userId: session?.user?.id || '',
            totalTokens: event.usage.totalTokens,
            name: 'ai_scribe_generation',
          },
        });
      },
    });

    return result.toUIMessageStreamResponse();
  }
  // Create non-streaming response
  const { text, usage } = await generateText(commonParams);

  // Log usage in development
  if (env.NODE_ENV === 'development') {
    const logData = {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      userId: session?.user?.id || 'unknown',
      promptName: config.promptName,
    };
    const _ = logData;
  }

  // Log tokens to the postgres database for usage tracking
  await database.usageEvent.create({
    data: {
      userId: session?.user?.id || '',
      totalTokens: usage.totalTokens,
      name: 'ai_scribe_generation',
    },
  });

  return Response.json({ text });
}

export function createScribeHandler(
  config: ScribeHandlerConfig
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      // Get session and subscription
      const authResult = await checkAuthAndSubscription();
      if (authResult instanceof Response) {
        return authResult;
      }
      const { session } = authResult;

      // Parse request body
      const requestBody = await req.json();

      // Process request
      const processed = await processRequest(config, requestBody);
      if ('error' in processed) {
        return new Response(processed.error, { status: processed.status });
      }

      // Check authentication and subscription - allow for every logged in user for now
      const allowAIUseFlag = !!session?.user;
      if (!allowAIUseFlag) {
        return new Response(
          'Unauthorized: Du brauchst ein aktives Abo um diese Funktion zu nutzen.',
          { status: 401 }
        );
      }

      if (!session?.user?.stripeCustomerId) {
        return new Response(
          'Unauthorized: Du musst einen Stripe Account haben um diese Funktion zu nutzen.',
          { status: 401 }
        );
      }

      // Get Langfuse prompt
      const textPrompt = await getLangfusePrompt(
        config.promptName,
        config.promptLabel
      );

      // Compile prompt with processed input and today's date
      const compiledPrompt = textPrompt.compile({
        ...processed.processedInput,
        todaysDate: processed.todaysDate,
      });

      const messages: CoreMessage[] = compiledPrompt as CoreMessage[];

      // Prepare base metadata
      const baseMetadata: Record<string, string | number | boolean> = {
        userId: session?.user?.id || 'unknown',
        promptName: config.promptName,
        ...processed.processedInput,
      };

      // Add custom metadata if provided
      const customMetadata = config.getMetadata?.(
        requestBody,
        session?.user?.id || 'unknown'
      );
      const metadata = { ...baseMetadata, ...customMetadata };

      // Generate response with selected model
      return await generateResponse(
        config,
        messages,
        metadata,
        session,
        processed.model,
        processed.audio,
        processed.audioMimeType
      );
    } catch (error) {
      // Handle errors gracefully
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response(`Internal server error: ${errorMessage}`, {
        status: 500,
      });
    }
  };
}

// Helper function to create common input validators
export const createInputValidator = (requiredFields: string[]) => {
  return (input: unknown): { isValid: boolean; error?: string } => {
    if (!input || typeof input !== 'object') {
      return { isValid: false, error: 'Invalid input format' };
    }

    const inputObj = input as Record<string, unknown>;

    for (const field of requiredFields) {
      if (
        !inputObj[field] ||
        (typeof inputObj[field] === 'string' &&
          !inputObj[field].toString().trim())
      ) {
        return {
          isValid: false,
          error: `Missing or empty required field: ${field}`,
        };
      }
    }

    return { isValid: true };
  };
};

// Helper function to create common input processors
const _createInputProcessor = (fieldMapping?: Record<string, string>) => {
  return (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const inputObj = input as Record<string, unknown>;

    if (!fieldMapping) {
      return inputObj;
    }

    // Apply field mapping if provided
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(inputObj)) {
      const mappedKey = fieldMapping[key] || key;
      processed[mappedKey] = value;
    }

    return processed;
  };
};
