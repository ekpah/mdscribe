export const DIAGNOSIS_QUALITY_CONTROL = `<quality_control>
<pre_submission_check>
- HAUPTDIAGNOSE korrekt identifiziert und an erster Stelle
- ALLE BEHANDLUNGSRELEVANTEN Diagnosen aufgeführt
- KODIERUNG soweit möglich vorhanden
- PRÄZISE FORMULIERUNG mit allen notwendigen Details
- SYSTEMATISCHE GLIEDERUNG erkennbar
- KEINE inhaltlichen Widersprüche zu den Eingabedaten
- FORMAT konsistent und übersichtlich
</pre_submission_check>

<uncertainty_handling>
- Bei unsicheren Diagnosen: "V.a." (Verdacht auf) verwenden
- Bei fehlenden Codes: Diagnose ohne Code aufführen
- KEINE Diagnosen erfinden oder spekulieren
- Bei Unklarheiten zur Hauptdiagnose: nach Behandlungsaufwand entscheiden
</uncertainty_handling>
</quality_control>`;
