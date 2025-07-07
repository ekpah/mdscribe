import {
  createInputValidator,
  createScribeHandler,
} from '../../_lib/scribe-handler';

const handleDischarge = createScribeHandler({
  promptName: 'Inpatient_discharge_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: (input: unknown) => {
    const { prompt } = input as { prompt: string };
    const { dischargeNotes } = JSON.parse(prompt);
    return { notes: dischargeNotes };
  },
  modelConfig: {
    thinking: true,
    thinkingBudget: 8000,
    maxTokens: 20_000,
    temperature: 1,
  },
});

export const POST = handleDischarge;
