import {
	createInputValidator,
	createScribeHandler,
} from "@/app/api/scribe/_lib/scribe-handler";

const handlePhysicalExam = createScribeHandler({
	promptName: "ER_Koerperliche_Untersuchung_chat",
	validateInput: createInputValidator(["prompt"]),
	processInput: (input) => {
		const { prompt } = input as { prompt: string };
		const parsed = JSON.parse(prompt);
		const { notes } = parsed;

		return {
			notes,
		};
	},
});

export const POST = handlePhysicalExam;
