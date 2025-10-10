import {
  createInputValidator,
  createScribeHandler,
} from '../../_lib/scribe-handler';

const handleOutpatient = createScribeHandler({
  promptName: 'Outpatient_visit_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: (input) => {
    const { prompt } = input as { prompt: string };

    // Parse the prompt JSON to extract anamnese and vordiagnosen
    const parsed = JSON.parse(prompt);
    const {
      anamnese,
      diagnoseblock = 'Keine Vorerkrankungen',
      dischargeNotes,
      befunde,
    } = parsed;

    return {
      anamnese,
      notes: dischargeNotes,
      diagnoseblock,
      befunde,
    };
  },
  modelConfig: {
    thinking: true,
    maxTokens: 20_000,
    temperature: 1,
  },
});

export const POST = handleOutpatient;
