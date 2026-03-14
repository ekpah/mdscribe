import { CustomAiscribeClient } from "../_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "../_lib/resolve-built-in-form";

export default async function DiagnoseblockPage() {
	const overrideForm = await resolveBuiltInAiscribeOverrideForm("diagnoseblock");

	return (
		<CustomAiscribeClient
			mode="built-in"
			overrideForm={overrideForm}
			template="diagnoseblock"
		/>
	);
}
