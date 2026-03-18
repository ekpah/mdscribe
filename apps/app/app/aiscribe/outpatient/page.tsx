import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";
import { resolveBuiltInAiscribeOverrideForm } from "@/app/aiscribe/_lib/resolve-built-in-form";

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
