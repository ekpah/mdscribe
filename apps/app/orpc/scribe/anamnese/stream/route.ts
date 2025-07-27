import {
  createInputValidator,
  createScribeHandler,
} from '@/app/api/scribe/_lib/scribe-handler';

// Create the handler with specific configuration for anamnese
const handleAnamnese = createScribeHandler({
  promptName: 'ER_Anamnese_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: (input) => {
    const { prompt } = input as { prompt: string };

    // Parse the prompt JSON to extract anamnese and vordiagnosen
    const parsed = JSON.parse(prompt);
    const { anamnese, vordiagnosen = 'Keine Vorerkrankungen' } = parsed;

    return {
      anamnese,
      vordiagnosen,
    };
  },
  getMetadata: (input) => {
    const { prompt } = input as { prompt: string };
    return {
      inputLength: prompt.length,
      hasVordiagnosen: prompt.includes('vordiagnosen'),
    };
  },
});

export const POST = handleAnamnese;
