import { CustomAiscribeClient } from "../_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "../_lib/resolve-built-in-form";

export default async function ERAIGenerator() {
	const overrideForm = await resolveBuiltInAiscribeOverrideForm("er");

	return (
		<CustomAiscribeClient
			mode="built-in"
			overrideForm={overrideForm}
			template="er"
		/>
	);
}
