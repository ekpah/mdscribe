import { ANAMNESE_GUIDELINES } from "./shared/guidelines";
import { ANAMNESE_SYSTEM_ROLE } from "./shared/system-role";

const ANAMNESE_SYSTEM_PROMPT_PARTS = [ANAMNESE_SYSTEM_ROLE, ANAMNESE_GUIDELINES];

export const ANAMNESE_SYSTEM_PROMPT = ANAMNESE_SYSTEM_PROMPT_PARTS.join("\n\n");
