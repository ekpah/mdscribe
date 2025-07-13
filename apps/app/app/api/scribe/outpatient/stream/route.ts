import {
  createInputValidator,
  createScribeHandler,
} from '../../_lib/scribe-handler';

const handleOutpatient = createScribeHandler({
  promptName: 'Outpatient_visit_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: (input: unknown) => {
    const { prompt } = input as { prompt: string };
    const { consultationNotes } = JSON.parse(prompt);
    return { notes: consultationNotes };
  },
  modelConfig: {
    thinking: true,
    maxTokens: 20_000,
    temperature: 1,
  },
});

export const POST = handleOutpatient;
