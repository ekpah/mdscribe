import {
  createInputValidator,
  createScribeHandler,
} from '@/app/api/scribe/_lib/scribe-handler';

// Create the handler with specific configuration for diagnosis
const handleDiagnosis = createScribeHandler({
  promptName: 'ER_Diagnose_chat',
  streaming: false, // Use non-streaming response for diagnosis
  validateInput: createInputValidator(['prompt']),
  processInput: (input) => {
    const { prompt } = input as { prompt: string };

    // Parse the prompt JSON to extract anamnese
    const parsed = JSON.parse(prompt);
    const { anamnese } = parsed;

    return {
      anamnese,
    };
  },
  modelConfig: {
    maxTokens: 2000,
    temperature: 0,
    thinkingBudget: 8000,
  },
  getMetadata: (input) => {
    const { prompt } = input as { prompt: string };
    return {
      inputLength: prompt.length,
      isEmptyPrompt: prompt.trim().length === 0,
    };
  },
});

export const POST = handleDiagnosis;
