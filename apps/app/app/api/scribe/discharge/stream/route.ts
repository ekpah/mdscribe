import {
  createInputValidator,
  createScribeHandler,
} from '../../_lib/scribe-handler';

const handleDischarge = createScribeHandler({
  promptName: 'Inpatient_discharge_chat',
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
    thinkingBudget: 12_000,
    maxTokens: 20_000,
    temperature: 0.3,
  },
});

export const POST = handleDischarge;
