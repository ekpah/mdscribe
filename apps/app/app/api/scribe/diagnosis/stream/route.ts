import {
  createInputValidator,
  createScribeHandler,
} from '@/app/api/scribe/_lib/scribe-handler';

// Create the handler with specific configuration for diagnoseblock update
const handleDiagnoseblock = createScribeHandler({
  promptName: 'diagnoseblock_update',
  validateInput: createInputValidator(['prompt']),
  processInput: (input) => {
    const { prompt } = input as { prompt: string };

    // Parse the prompt JSON to extract all fields
    const parsed = JSON.parse(prompt);
    const {
      anamnese,
      diagnoseblock = 'Keine Vorerkrankungen',
      notes,
      befunde,
    } = parsed;

    return {
      anamnese,
      notes,
      diagnoseblock,
      befunde,
    };
  },
  modelConfig: {
    thinking: false,
    maxTokens: 2000,
    temperature: 0.1,
  },
});

export const POST = handleDiagnoseblock;
