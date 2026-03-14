import { buildClinicalSystemRole } from "@/orpc/scribe/prompts/families/shared/clinical-system-role";

export const DIAGNOSIS_SYSTEM_ROLE = buildClinicalSystemRole(
	"Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen den Diagnoseblock für einen Arztbrief zu erstellen. Nutzen Sie hierfür die vorliegenden Vordiagnosen und Befunde und Notizen des aktuellen Aufenthaltes.",
);
