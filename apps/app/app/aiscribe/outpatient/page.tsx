import { CustomAiscribeClient } from "../_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "../_lib/resolve-built-in-form";

export default async function OutpatientPage() {
	const overrideForm = await resolveBuiltInAiscribeOverrideForm("outpatient");

	return (
		<CustomAiscribeClient
			mode="built-in"
			overrideForm={overrideForm}
			template="outpatient"
		/>
	);
}
