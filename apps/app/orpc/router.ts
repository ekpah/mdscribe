import { authed, pub } from '@/orpc';
import { scribeHandler } from './scribe';
import { getUsage } from './scribe/_lib/get-usage';
import { templatesHandler as publicTemplatesHandler } from './templates';
import { templatesHandler as userTemplatesHandler } from './user/templates';

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

const getUsageHandler = authed.handler(({ context }) => {
    return getUsage(context.session);
});

export const router = {
    scribe: scribeHandler,
    getUsage: getUsageHandler,
    templates: publicTemplatesHandler,
    user: {
        templates: {
            ...userTemplatesHandler,
        },
    },
};
