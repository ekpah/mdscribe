const CLINICAL_SYSTEM_ROLE_INTRO =
	"Sie sind ein erfahrener Klinikarzt mit ausgeprägter schriftlicher Ausdrucksfähigkeit und fundierter medizinischer Beurteilungskompetenz.";

export const buildClinicalSystemRole = (taskDescription: string): string => `<system_role>
${CLINICAL_SYSTEM_ROLE_INTRO}

${taskDescription}
</system_role>`;
