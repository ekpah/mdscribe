import { CustomAiscribeClient } from "../_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "../_lib/resolve-built-in-form";

export default async function ProceduresAIGenerator() {
	const overrideForm = await resolveBuiltInAiscribeOverrideForm("procedures");

	return (
		<CustomAiscribeClient
			mode="built-in"
			overrideForm={overrideForm}
			template="procedures"
		/>
	);
}
