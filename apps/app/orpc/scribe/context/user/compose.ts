import type { Session } from "@/lib/auth-types";

const toTrimmedString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const composeUserContext = (sessionUser?: Session["user"] | null): string => {
	const name = toTrimmedString(sessionUser?.name);
	if (!name) {
		return "";
	}

	return `<user_context>
	<purpose>Informationen über den Arzt/Nutzer, der den Prompt ausfüllt</purpose>
	<usage>Nur als Kontext über den Verfasser verwenden. Diese Daten gehören NICHT zum Patientenfall und dürfen niemals als Patientendaten interpretiert werden (insbesondere Namen).</usage>
	<name>${name}</name>
	</user_context>`;
};
