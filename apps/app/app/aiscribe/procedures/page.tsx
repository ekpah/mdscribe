import { CustomAiscribeClient } from "@/app/aiscribe/_components/custom-aiscribe-client";
import { getAiscribeIsAdmin } from "@/app/aiscribe/_lib/access";
import { resolveBuiltInAiscribeOverrideForm } from "@/app/aiscribe/_lib/resolve-built-in-form";

export default async function ProceduresAIGenerator() {
	const [overrideForm, isAdmin] = await Promise.all([
		resolveBuiltInAiscribeOverrideForm("procedures"),
		getAiscribeIsAdmin(),
	]);

	return (
		<CustomAiscribeClient
			isAdmin={isAdmin}
			mode="built-in"
			overrideForm={overrideForm}
			template="procedures"
		/>
	);
}
