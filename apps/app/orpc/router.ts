import { os } from '@orpc/server';
import { z } from 'zod';
import { generateResponse } from './scribe/route';

const ScribeInputSchema = z.object({
    anamnese: z.string().optional(),
    vordiagnosen: z.string().optional(),
    diagnoseblock: z.string().optional(),
    befunde: z.string().optional(),
});

const ScribeOutputSchema = z.object({
    response: z.string(),
});

const defaultTemplate = `

Template structure
[face to face “F2F” OR if calling via telephone “T / C”][specify whether anyone else is present I.e. “seen alone” or “seen with…” (based on introductions). ‘[Reason for visit, e.g.current issues or presenting complaint or booking note or follow up]’.

History:
-[History of presenting complaints]
    - [ICE: Patient's Ideas, Concerns and Expectations]
        - [Presence or absence of red flag symptoms relevant to the presenting complaint]
        - [Relevant risk factors]
        - [PMH: / PSH: - include the past medical history or surgical history (if applicable)]
        - [DH: Drug history / medications(if mentioned)].[Allergies: (only include if explicitly mentioned in the transcript, contextual notes or clinical note, otherwise leave blank)]
-[FH: Relevant family history(if applicable)]
-[SH: Social history I.e.lives with, occupation, smoking / alcohol / drugs, recent travel, carers / package of care(if applicable)]

Examination:
-[Vital signs listed, eg.T, Sats %, HR, BP, RR, (as applicable)]
    - [Physical or mental state examination findings, including system specific examination](only include if applicable, and use as many bullet points as needed to capture the examination findings)
-[Investigations with results(include only if applicable and if mentioned)]

Impression:
[1. Issue, problem or request 1(issue, request or condition name only)]. [Assessment, likely diagnosis for Issue 1(condition name only)(include only if mentioned)]
-[Differential diagnosis for Issue 1(include only if applicable and if mentioned)]
[2. Issue, problem or request 2(issue, request or condition name only)]. [Assessment, likely diagnosis for Issue 2(condition name only)(include only if mentioned)]
-[Differential diagnosis for Issue 2(include only if applicable and if mentioned)]
[3. Issue, problem or request 3, 4, 5 etc(issue, request or condition name only)]. [Assessment, likely diagnosis for Issue 3, 4, 5 etc(condition name only)(include only if mentioned)]
-[Differential diagnosis for Issue 3, 4, 5 etc(include only if applicable and if mentioned)]

Plan:
-[Investigations planned for Issue 1(include only if applicable and if mentioned)]
-[Treatment planned for Issue 1(include only if applicable and if mentioned)]
-[Relevant referrals for Issue 1(include only if applicable and if mentioned)]
-[Investigations planned for Issue 2(include only if applicable and if mentioned)]
-[Treatment planned for Issue 2(include only if applicable and if mentioned)]
-[Relevant referrals for Issue 2(include only if applicable and if mentioned)]
-[Investigations planned for Issue 3, 4, 5 etc(include only if applicable and if mentioned)]
-[Treatment planned for Issue 3, 4, 5 etc(include only if applicable and if mentioned)]
-[Relevant referrals for Issue 3, 4, 5 etc(include only if applicable and if mentioned)]
-[Follow up plan(noting timeframe if stated or applicable and if mentioned)]
-[Safety netting advice given(for example, if mentioned, state which symptoms would mean they need to call back GP OR call 111(non - life threatening) for out of hours GP or if deteriorates to attend A & E / call 999 in life - threatening emergency(include only the advice / options which are mentioned in transcript or contextual notes))]

(Never come up with your own patient details, assessment, diagnosis, differential diagnosis, plan, interventions, evaluation, plan for continuing care, safety netting advice, etc - use only the transcript, contextual notes or clinical note as a reference for the information you include in your note.If any information related to a placeholder has not been explicitly mentioned in the transcript or contextual notes, you must not state the information has not been explicitly mentioned in your output, just leave the relevant placeholder or section blank.) (Use as many sentences as needed to capture all the relevant information from the transcript and contextual notes.)`

export const scribeHandler = os
    .input(ScribeInputSchema)
    .handler(({ input }) => {
        return generateResponse({ patientData: input, template: defaultTemplate });
    });

export const router = {
    scribe: {
        handler: scribeHandler
    }
}
