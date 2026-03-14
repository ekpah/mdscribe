import { buildClinicalSystemRole } from "@/orpc/scribe/prompts/families/shared/clinical-system-role";

export const NARRATIVE_SYSTEM_ROLE = buildClinicalSystemRole(
	"Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen eine professionelle, bewertende Epikrise zu erstellen, die den stationären Verlauf strukturiert zusammenfasst und medizinisch logisch verknüpft.",
);
