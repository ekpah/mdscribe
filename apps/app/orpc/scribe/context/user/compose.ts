import type { Session } from "@/lib/auth-types";

const toTrimmedString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const composePersonalPreferences = (personalContext?: string | null): string => {
	const preferences = toTrimmedString(personalContext);
	if (!preferences) {
		return "";
	}

	return `<personal_preferences>
	<usage>Persönliche Dokumentationspräferenzen des Arztes/Nutzers. Befolge sie bei Stil, Formulierung, Abkürzungen und Format konsequent; sie haben Vorrang vor allgemeinen Stilvorgaben. Sie sind keine Patientendaten, ändern keine Fakten und erlauben niemals, Informationen zu erfinden.</usage>
	${preferences}
	</personal_preferences>`;
};

export const composeUserContext = (
	sessionUser?: Session["user"] | null,
	personalContext?: string | null,
): string => {
	const name = toTrimmedString(sessionUser?.name);
	const preferences = composePersonalPreferences(personalContext);
	if (!(name || preferences)) {
		return "";
	}

	return `<user_context>
	<purpose>Informationen über den Arzt/Nutzer, der den Prompt ausfüllt</purpose>
	<usage>Nur als Kontext über den Verfasser verwenden. Diese Daten gehören NICHT zum Patientenfall und dürfen niemals als Patientendaten interpretiert werden (insbesondere Namen).</usage>${name ? `\n\t<name>${name}</name>` : ""}${preferences ? `\n\t${preferences}` : ""}
	</user_context>`;
};
