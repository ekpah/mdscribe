import type {
	MarkdocContractAttribute,
	MarkdocTagDiagnostic,
} from "@repo/markdoc-md/parse/validate-markdoc-tag-contracts";

const MARKDOC_ATTRIBUTE_LABELS: Record<MarkdocContractAttribute, string> = {
	description: "Beschreibung",
	formula: "Formel",
	type: "Typ",
	unit: "Einheit",
};

const MARKDOC_TAG_LABELS = {
	info: "Info-Tag",
	score: "Score-Tag",
	switch: "Switch-Tag",
} as const;

export const formatMarkdocTagDiagnostic = (diagnostic: MarkdocTagDiagnostic): string => {
	if (diagnostic.code === "tag-kind-conflict") {
		return `„${diagnostic.primary}“ wird sowohl als ${MARKDOC_TAG_LABELS[diagnostic.firstTag]} als auch als ${MARKDOC_TAG_LABELS[diagnostic.conflictingTag]} verwendet.`;
	}

	const attributes = diagnostic.conflicts
		.map((conflict) => MARKDOC_ATTRIBUTE_LABELS[conflict.attribute])
		.join(", ");
	return `${MARKDOC_TAG_LABELS[diagnostic.tag]} „${diagnostic.primary}“ verwendet widersprüchliche Einstellungen: ${attributes}.`;
};

/** Single source of truth for all user-facing German messages. */
export const USER_MESSAGES = {
	adminUsers: {
		aiScribeForms: "AI Vorlagen",
		aiScribeWorkspaces: "Brief-Baukästen",
		monthlyAiUsage: "KI-Nutzung",
	},
	aiscribeGenerationSuccess: "Erfolgreich generiert",
	audioNotSupported: "Das ausgewählte Modell unterstützt keine Audio-Eingabe.",
	checkingTemplateTags: "Tags werden geprüft...",
	documentEditor: {
		addCheckboxAsOption: "Checkbox als Option hinzufügen",
		aiDefinitionTooLarge: "Das PDF enthält zu viele Formulardaten für eine KI-Optimierung.",
		aiEnhancementFailed: "Eingaben konnten nicht mit KI optimiert werden.",
		aiModelUnavailable: "Kein kompatibles KI-Modell für PDF-Analyse verfügbar.",
		aiProposalInvalid: "Der KI-Vorschlag konnte nicht angewendet werden.",
		cancelAddingCheckbox: "Hinzufügen abbrechen",
		detachCheckboxOption: "Als einzelne Checkbox abtrennen",
		editDocument: "Dokument bearbeiten",
		forkDocument: "Dokument kopieren und bearbeiten",
		pdfUploadFailed: "PDF konnte nicht verarbeitet werden.",
		pdfUploadSuccess: "Dokument hochgeladen",
		selectCheckboxAsOption: "Als Option hinzufügen",
	},
	documentPlaygroundFormFields: {
		copySuccess: "Formularfelder kopiert",
		description: "Direkt mit pdf-lib aus der PDF extrahiert – ohne KI-Modell.",
		empty: "Diese PDF enthält keine auslesbaren AcroForm-Felder.",
		extractionFailed: "Die Formularfelder konnten nicht aus der PDF ausgelesen werden.",
		fieldCount: "Felder",
		loading: "Formularfelder werden ausgelesen…",
		propertyLabels: {
			fieldType: "Bibliothekstyp",
			inputKind: "Eingabeart",
			isExported: "Wird exportiert",
			isReadOnly: "Schreibgeschützt",
			isRequired: "Pflichtfeld",
			label: "Bezeichnung",
			maxLength: "Maximale Länge",
			name: "Feldname",
			options: "Optionen",
			type: "PDF-Typ",
			value: "Wert",
			widgetCount: "Darstellungen",
		},
		rawJson: "JSON-Rohdaten",
		tab: "Formularfelder",
		unavailable: "Formularfelder sind nur für PDF-Dateien verfügbar.",
	},
	evaluationFailed:
		"Die Bewertung konnte nicht erzeugt werden. Bitte versuchen Sie es später erneut.",
	filesNotSupported: "Das ausgewählte Modell unterstützt keine Datei-Eingabe.",
	inputInvalid: "Die Eingaben konnten nicht verarbeitet werden. Bitte prüfen Sie Ihre Angaben.",
	invalidTemplateTags:
		"Einige Tags mit demselben Namen haben widersprüchliche Einstellungen. Gleichen Sie die Einstellungen an.",
	lowScribeUsageRemaining:
		"Weniger als 10 % Ihres monatlichen KI-Budgets sind verfügbar. Passen Sie Ihr Abonnement rechtzeitig an, um Unterbrechungen zu vermeiden.",
	lowScribeUsageSubscriptionAction: "Abo ansehen",
	missingInput: "Bitte füllen Sie mindestens ein Pflichtfeld aus.",
	modelUnavailable:
		"Kein geeignetes KI-Modell verfügbar. Bitte konfigurieren Sie ein Modell in den Einstellungen.",
	privateAiScribeFormRequiresPlus:
		"Private AI Vorlagen sind nur mit Plus verfügbar. Speichern Sie die AI Vorlage öffentlich oder aktualisieren Sie Ihr Abo.",
	privateAiScribeWorkspaceRequiresPlus:
		"Private Brief-Baukästen sind nur mit Plus verfügbar. Speichern Sie den Brief-Baukasten öffentlich oder aktualisieren Sie Ihr Abo.",
	privateDocumentRequiresPlus:
		"Private Dokumente sind nur mit Plus verfügbar. Speichern Sie das Dokument öffentlich oder aktualisieren Sie Ihr Abo.",
	privateTemplateRequiresPlus:
		"Private Textbausteine sind nur mit Plus verfügbar. Speichern Sie den Textbaustein öffentlich oder aktualisieren Sie Ihr Abo.",
	providerAuthFailed:
		"Der API-Schlüssel wurde vom Anbieter abgelehnt. Bitte prüfen Sie die Konfiguration.",
	providerUnavailable: "Der KI-Anbieter ist nicht erreichbar. Bitte prüfen Sie die Verbindung.",
	publicAiScribeFormVisibilityWarning:
		"Öffentlich: Alle Nutzer können diese AI Vorlage sehen und verwenden.",
	publicAiScribeWorkspaceVisibilityWarning:
		"Öffentlich: Alle Nutzer können diesen Brief-Baukasten sehen und verwenden.",
	publicDocumentVisibilityWarning:
		"Öffentlich: Alle Nutzer können dieses Dokument sehen, verwenden und kopieren.",
	publicTemplateVisibilityWarning:
		"Öffentlich: Alle Nutzer können diesen Textbaustein sehen, verwenden und kopieren.",
	resolveTemplateTagErrors: "Tag-Konflikte vor dem Speichern beheben",
	searchableSelect: {
		empty: "Keine passenden Optionen gefunden.",
		search: "Auswahl durchsuchen...",
		templateEmpty: "Keine passenden Templates gefunden.",
		templateSearch: "Template suchen...",
		userEmpty: "Keine passenden Nutzer gefunden.",
		userSearch: "Nutzer suchen...",
	},
	subscriptionRequired: "Ihr Abonnement reicht nicht aus. Bitte aktualisieren Sie Ihr Abo.",
	templateSearch: {
		description: "Durchsuchen Sie alle für Sie verfügbaren Textbausteine.",
		empty: "Keine passenden Textbausteine gefunden.",
		label: "Textbausteine durchsuchen",
		placeholder: "Zum Beispiel Entlassungsbrief oder Hypertonie",
		results: "Suchergebnisse",
		title: "Textbaustein finden",
	},
	unauthorized: "Bitte melden Sie sich an, um diese Funktion zu nutzen.",
	unknownError: "Es ist ein unbekannter Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
	usageLimitReached: "Monatliche Nutzungsgrenze erreicht. Bitte passen Sie Ihr Abonnement an.",
	userNameAlreadyTaken: "Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen.",
	userNameFallbackHint:
		"Wenn du keinen Benutzernamen einträgst, verwenden wir den Teil vor dem @ deiner E-Mail-Adresse.",
	userNameMaxLength: "Benutzername darf nicht länger als 30 Zeichen sein.",
	userNameMaxLengthHint: "Maximal 30 Zeichen erlaubt.",
	weeklyUsageProjectionHint:
		"Die gestrichelte Linie zeigt die auf sieben Tage hochgerechnete Nutzung der laufenden Woche.",
	weeklyUsageProjectionLabel: "Prognose KI-Anfragen (Woche)",
};
