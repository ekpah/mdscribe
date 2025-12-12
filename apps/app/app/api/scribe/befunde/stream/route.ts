import {
	createInputValidator,
	createScribeHandler,
} from "@/app/api/scribe/_lib/scribe-handler";

const handleBefunde = createScribeHandler({
	promptName: "ER_Befunde_chat",
	validateInput: createInputValidator(["prompt"]),
	processInput: (input) => {
		const { prompt } = input as { prompt: string };
		const parsed = JSON.parse(prompt);
		const {
			notes,
			anamnese = "",
			vordiagnosen = "Keine Vorerkrankungen",
		} = parsed;

		return {
			notes,
			anamnese,
			vordiagnosen,
		};
	},
});

export const POST = handleBefunde;

