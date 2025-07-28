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
    const { notes, vordiagnosen = 'Keine Vorerkrankungen' } = parsed;

    return {
      notes,
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
