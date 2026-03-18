import { ANAMNESE_GUIDELINES } from "@/orpc/scribe/prompts/core/anamnese-guidelines";
import { SYSTEM_ROLE } from "@/orpc/scribe/prompts/core/clinical-system-role";

export const ANAMNESE_SYSTEM_PROMPT = `${SYSTEM_ROLE}

${ANAMNESE_GUIDELINES}`;
