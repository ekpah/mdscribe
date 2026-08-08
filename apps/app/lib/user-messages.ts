import type {
	MarkdocContractAttribute,
	MarkdocTagDiagnostic,
} from "@repo/markdoc-md/parse/validate-markdoc-tag-contracts";

const MARKDOC_ATTRIBUTE_LABELS: Record<MarkdocContractAttribute, string> = {
	description: "Beschreibung",
	formula: "Formel",
	source: "Quelle",
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
	adminByok: {
		ariaLabel: "BYOK für diese Verbindung erlauben",
		credentialCounts: (stored: number, active: number) =>
			`${stored} hinterlegt, ${active} aktiv`,
		label: "BYOK - Nutzer können eigene API-Schlüssel verwenden",
		toggleError: "BYOK-Einstellung konnte nicht gespeichert werden.",
		toggleSuccess: "BYOK-Einstellung gespeichert",
	},
	adminEmails: {
		broadcastAccepted: "vom SMTP-Relay angenommen",
		broadcastDialogDescription:
			"Sendet den ausgewählten Marketing-Entwurf über den konfigurierten SMTP-Provider an alle verifizierten Nutzerkonten.",
		broadcastFailed: "fehlgeschlagen",
		broadcastPartialTitle: "E-Mail-Broadcast teilweise versendet",
		broadcastSuccessTitle: "E-Mail-Broadcast versendet",
	},
	adminTemplates: {
		allAuthors: "Alle Autoren",
		allUsers: "Alle Nutzer",
		author: "Autor",
		authors: "Autoren",
		description: "Übersicht aller Vorlagen, Favoriten und Autoren",
		empty: "Keine Vorlagen für die aktuellen Filter gefunden.",
		favouritedBy: "Favorisiert von",
		favourites: "Favoriten",
		loadError: "Seite konnte nicht geladen werden",
		loading: "Vorlagenverwaltung wird geladen...",
		of: "von",
		overviewDescription: "Filterbar nach Autor und Favorisiert-von",
		overviewTitle: "Template-Übersicht",
		searchPlaceholder: "Vorlage, Kategorie oder Autor suchen...",
		template: "Vorlage",
		templates: "Vorlagen",
		title: "Vorlagenverwaltung",
		totalFavourites: "Favoriten gesamt",
		totalTemplates: "Vorlagen gesamt",
		unknown: "Unbekannt",
		updated: "Aktualisiert",
	},
	adminUsers: {
		aiScribeForms: "AI Vorlagen",
		aiScribeWorkspaces: "Brief-Baukästen",
		monthlyAiUsage: "KI-Nutzung",
	},
	aiscribeGenerationSuccess: "Erfolgreich generiert",
	audioNotSupported: "Das ausgewählte Modell unterstützt keine Audio-Eingabe.",
	byok: {
		active: "Aktiv",
		activeDescription:
			"Generierungen über diese Verbindung verwenden deinen eigenen API-Schlüssel und verbrauchen dafür keine MDScribe-Quota. Kosten und Limits des Anbieters gelten weiterhin.",
		apiKeyLabel: "API-Schlüssel",
		apiKeyPlaceholder: "API-Schlüssel eingeben",
		assignedModelsDescription:
			"Wenn dein Schlüssel aktiv ist, wird er für diese vom Administrator festgelegten Modelle verwendet.",
		assignedModelsHeading: "Zugeordnete Modelle",
		cancel: "Abbrechen",
		connectionUnavailable:
			"Diese Verbindung ist für eigene API-Schlüssel nicht verfügbar.",
		connectionUnavailableStatus: "Nicht mehr freigeschaltet",
		credentialDeleted: "Eigener API-Schlüssel gelöscht",
		credentialDescription:
			"Der Schlüssel wird verschlüsselt gespeichert und niemals wieder angezeigt.",
		credentialDisabled: "Eigener API-Schlüssel deaktiviert",
		credentialEnabled: "Eigener API-Schlüssel aktiviert",
		credentialMissing: "Für diese Verbindung ist kein eigener API-Schlüssel hinterlegt.",
		credentialSaved: "API-Schlüssel geprüft und gespeichert",
		deactivate: "Deaktivieren",
		delete: "Verbindung löschen",
		deleteConfirm: "Löschen bestätigen",
		disabledDescription:
			"Der eigene API-Schlüssel ist gespeichert, wird aber nicht für Anfragen verwendet.",
		displayNameLabel: "Name",
		displayNamePlaceholder: "Bezeichnung der Verbindung",
		emptyDescription:
			"Hinterlege einen eigenen API-Schlüssel für diese vom Administrator konfigurierte Verbindung.",
		enable: "Aktivieren",
		hasApiKey: "API-Schlüssel hinterlegt",
		heading: "KI-Zugang",
		inactive: "Deaktiviert",
		intro:
			"Verwalte eigene API-Schlüssel für die vom Administrator freigeschalteten KI-Verbindungen.",
		keyRejected:
			"Der API-Schlüssel wurde vom Anbieter abgelehnt. Bitte prüfe den Schlüssel.",
		modelRoles: {
			agent: "Agent",
			audio: "Audio",
			documents: "Dokumente",
			text: "Standardgenerierung",
		},
		noAssignedModels:
			"Der Administrator hat dieser Verbindung aktuell kein verwendetes Modell zugeordnet.",
		noConnections:
			"Der Administrator hat keine Verbindungen für eigene API-Schlüssel freigeschaltet.",
		providerRateLimited:
			"Der Anbieter begrenzt derzeit die Schlüsselprüfung. Bitte versuche es später erneut.",
		providerUnavailable:
			"Der Anbieter konnte den API-Schlüssel nicht prüfen. Bitte versuche es später erneut.",
		rename: "Name speichern",
		renamed: "Name gespeichert",
		replace: "API-Schlüssel ersetzen",
		save: "Verbindung prüfen und speichern",
		unavailableDescription:
			"Der Administrator hat diese Verbindung deaktiviert. Der Schlüssel bleibt gespeichert, wird aber nicht verwendet.",
		unlimited: "Unbegrenzte Generierungen über diese Verbindung",
		usageBadge: "BYOK",
		verified: "API-Schlüssel gespeichert und geprüft",
	},
	checkingTemplateTags: "Tags werden geprüft...",
	dashboard: {
		activity: {
			eventTitles: {
				admin_scribe_playground: "Playground-Generierung",
				ai_input_fill: "Eingaben mit KI ausgefüllt",
				ai_input_fill_inputs: "Eingaben mit KI ausgefüllt",
				ai_pdf_document_enhancement: "PDF-Formular mit KI optimiert",
				ai_pdf_form_parsing: "PDF-Formular analysiert",
				ai_scribe_agent: "Brief-Baukasten mit KI bearbeitet",
				ai_scribe_generation: "KI-Dokumentation generiert",
				ai_scribe_ocr: "Dokument mit OCR verarbeitet",
				ai_scribe_stt: "Audio transkribiert",
			},
			templateUsed: "Textbaustein verwendet",
			unknown: "KI-Funktion verwendet",
		},
	},
	documentEditor: {
		addCheckboxAsOption: "Checkbox als Option hinzufügen",
		aiDefinitionTooLarge: "Das PDF enthält zu viele Formulardaten für eine KI-Optimierung.",
		aiEnhancementFailed: "Eingaben konnten nicht mit KI optimiert werden.",
		aiModelUnavailable: "Kein kompatibles KI-Modell für PDF-Analyse verfügbar.",
		aiProposalInvalid: "Der KI-Vorschlag konnte nicht angewendet werden.",
		cancelAddingCheckbox: "Hinzufügen abbrechen",
		contentTabsLabel: "Dokumentinhalt",
		detachCheckboxOption: "Als einzelne Checkbox abtrennen",
		editDocument: "Dokument bearbeiten",
		forkDocument: "Dokument kopieren und bearbeiten",
		informationDescription:
			"Hinweise und Vorgaben zum Ausfüllen. Sie werden auch beim automatischen Ausfüllen als KI-Anweisungen berücksichtigt.",
		informationEmpty: "Keine Informationen hinterlegt.",
		informationEmptyDescription: "Dieses Dokument kann trotzdem direkt ausgefüllt werden.",
		informationLabel: "Informationen",
		informationPlaceholder: "Beschreiben Sie, wie dieses Dokument ausgefüllt werden soll.",
		pdfTabLabel: "PDF",
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
	playgroundEvaluation: {
		action: "Bewerten",
		failed: "Die Playground-Antwort konnte nicht bewertet werden.",
		showDetails: "Bewertungsdetails öffnen",
	},
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
	signIn: {
		emailNotVerified: "Bitte bestätigen Sie Ihre E-Mail-Adresse.",
		failed: "E-Mail-Adresse, Benutzername oder Passwort ist ungültig.",
	},
	subscriptionRequired: "Ihr Abonnement reicht nicht aus. Bitte aktualisieren Sie Ihr Abo.",
	templateInformationDescription:
		"Hinweise und Vorgaben für die KI. Sie werden als Anweisungen in den Vorlagenkontext aufgenommen.",
	templateInformationEmpty: "Keine Informationen hinterlegt.",
	templateInformationEmptyDescription:
		"Für diesen Textbaustein gelten keine zusätzlichen Anweisungen.",
	templateInformationLabel: "Informationen",
	templateInformationPlaceholder:
		"Beschreiben Sie, wie die Vorlage ausgefüllt werden soll, und ergänzen Sie relevante Vorgaben.",
	templateInformationTooLong: "Informationen dürfen höchstens 10.000 Zeichen lang sein.",
	templateSearch: {
		badge: "Vorlagenbibliothek",
		description: "Durchsuchen Sie alle für Sie verfügbaren Textbausteine.",
		emptyDescription:
			"Probieren Sie einen allgemeineren Begriff oder suchen Sie nach einem Titel oder einer Kategorie.",
		emptyTitle: "Noch kein passender Textbaustein",
		label: "Textbausteine durchsuchen",
		placeholder: "Zum Beispiel Entlassungsbrief oder Hypertonie",
		quickSearchLabel: "Schnellsuche",
		quickSearches: [
			{ label: "Entlassbrief", query: "Entlassbrief" },
			{ label: "Anamnese", query: "Anamnese" },
			{ label: "Diagnose", query: "Diagnose" },
		],
		results: "Treffer",
		resultsFor: "für",
		searchAction: "Suchen",
		searchScope: "Titel und Kategorien",
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

export const formatGeneratedAiFormActivity = (name: string): string => `${name} generiert`;
