import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "@/app/aiscribe/_lib/resolve-built-in-form";

export default async function DischargeAIGenerator() {
	const overrideForm = await resolveBuiltInAiscribeOverrideForm("discharge");

	return (
		<CustomAiscribeClient
			mode="built-in"
			overrideForm={overrideForm}
			template="discharge"
		/>
	);
}
