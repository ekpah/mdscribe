import {
	createInputValidator,
	createScribeHandler,
} from "@/app/api/scribe/_lib/scribe-handler";

const handleAdmissionTodos = createScribeHandler({
	promptName: "ER_Admission_Todos_chat",
	validateInput: createInputValidator(["prompt"]),
	processInput: (input) => {
		const { prompt } = input as { prompt: string };
		const parsed = JSON.parse(prompt);
		const {
			notes,
			anamnese = "",
			vordiagnosen = "Keine Vorerkrankungen",
			befunde = "",
		} = parsed;

		return {
			notes,
			anamnese,
			vordiagnosen,
			befunde,
		};
	},
});

export const POST = handleAdmissionTodos;
