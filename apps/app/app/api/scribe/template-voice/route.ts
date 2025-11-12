import {
  createInputValidator,
  createScribeHandler,
} from '@/app/api/scribe/_lib/scribe-handler';

// Create the handler for voice input extraction
const handleTemplateVoice = createScribeHandler({
  promptName: 'template_voice_extraction',
  validateInput: (input: unknown): { isValid: boolean; error?: string } => {
    if (!input || typeof input !== 'object') {
      return { isValid: false, error: 'Invalid input format' };
    }

    const inputObj = input as Record<string, unknown>;

    // Check if we have either audioFiles or prompt
    const hasAudio =
      Array.isArray(inputObj.audioFiles) && inputObj.audioFiles.length > 0;
    const hasPrompt =
      typeof inputObj.prompt === 'string' && inputObj.prompt.trim().length > 0;

    if (!hasAudio && !hasPrompt) {
      return {
        isValid: false,
        error: 'Either audio files or prompt text must be provided',
      };
    }

    return { isValid: true };
  },
  processInput: (input) => {
    const { prompt, inputFields } = input as {
      prompt: string;
      inputFields: Array<{ name: string; type: string }>;
    };

    // Create a structured prompt for AI to extract information
    const inputFieldsDescription = inputFields
      .map(
        (field) =>
          `- ${field.name} (${field.type === 'number' ? 'numeric value' : 'text'})`
      )
      .join('\n');

    const extractionPrompt = `Based on the provided voice input, extract relevant information for the following fields:

${inputFieldsDescription}

Voice input text: ${prompt || '[Audio will be transcribed and analyzed]'}

For each field, provide:
1. A suggested value based on the voice input (or empty string if no relevant information)
2. Your confidence level (high/medium/low)

Return a JSON object with this structure:
{
  "field_name": {
    "value": "suggested value or empty string",
    "confidence": "high|medium|low"
  }
}

Important:
- Only suggest values when you find relevant information in the voice input
- Leave the value as an empty string if no relevant information is found
- Be conservative - don't guess or make up information
- For numeric fields, only suggest numeric values
- For date fields, use format DD.MM.YYYY`;

    return {
      extractionPrompt,
      inputFieldsCount: inputFields.length,
    };
  },
  getMetadata: (input) => {
    const { inputFields, prompt } = input as {
      prompt: string;
      inputFields: Array<{ name: string; type: string }>;
    };
    return {
      inputFieldsCount: inputFields.length,
      hasVoiceInput: prompt?.length > 0,
    };
  },
  modelConfig: {
    maxTokens: 4000,
    temperature: 0.3, // Lower temperature for more deterministic extraction
  },
});

export const POST = handleTemplateVoice;
