import {
  createInputValidator,
  createScribeHandler,
} from '../../../_lib/scribe-handler';

const handleICUTransfer = createScribeHandler({
  promptName: 'ICU_transfer_chat',
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
    thinking: false,
    maxTokens: 2000,
    temperature: 0.1,
  },
});

export const POST = handleICUTransfer;
