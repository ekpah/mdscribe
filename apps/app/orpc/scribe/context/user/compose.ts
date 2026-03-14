import type { Session } from "@/lib/auth-types";

const toTrimmedString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const composeUserContext = (sessionUser?: Session["user"] | null): string => {
	const name = toTrimmedString(sessionUser?.name);
	if (!name) {
		return "";
	}

	return `<user_context>
	<usage> Diese Informationen betreffen den Nutzer und geben einen Kontext über den behandelnden Arzt. Nutze diese Informationen nicht als Patienteninformationen, insbesondere nicht den Namen!</usage>
	<name>${name}</name>
	</user_context>`;
};
