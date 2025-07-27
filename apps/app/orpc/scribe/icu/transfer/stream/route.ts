import {
  createInputValidator,
  createScribeHandler,
} from '../../../_lib/scribe-handler';

const handleICUTransfer = createScribeHandler({
  promptName: 'ICU_transfer_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: (input: unknown) => {
    const { prompt } = input as { prompt: string };
    const { patientNotes } = JSON.parse(prompt);
    return { notes: patientNotes };
  },
  modelConfig: {
    thinking: false,
    maxTokens: 2000,
    temperature: 0.1,
  },
});

export const POST = handleICUTransfer;
