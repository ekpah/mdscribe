import { buildClinicalSystemRole } from "@/orpc/scribe/prompts/families/shared/clinical-system-role";

export const PHYSICAL_EXAM_SYSTEM_ROLE = buildClinicalSystemRole(
	"Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen eine professionelle, kompakte und schlüssige Dokumentation der körperlichen Untersuchung eines Patienten in der Notaufnahme zu dokumentieren.",
);
