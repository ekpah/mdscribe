import type { MarkdocContractAttribute, MarkdocTagDiagnostic } from "markdoc-md/parse";

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

const CURRENT_LANDING_DATE = new Intl.DateTimeFormat("de-DE", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "Europe/Berlin",
}).format(new Date());

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
		credentialCounts: (stored: number, active: number) => `${stored} hinterlegt, ${active} aktiv`,
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
		connectionUnavailable: "Diese Verbindung ist für eigene API-Schlüssel nicht verfügbar.",
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
		keyRejected: "Der API-Schlüssel wurde vom Anbieter abgelehnt. Bitte prüfe den Schlüssel.",
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
				admin_scribe_playground: "Historische Admin-Generierung",
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
	filesNotSupported: "Das ausgewählte Modell unterstützt keine Datei-Eingabe.",
	inputInvalid: "Die Eingaben konnten nicht verarbeitet werden. Bitte prüfen Sie Ihre Angaben.",
	invalidTemplateTags:
		"Einige Tags mit demselben Namen haben widersprüchliche Einstellungen. Gleichen Sie die Einstellungen an.",
	landing: {
		features: {
			description:
				"Vorlagen bleiben als Text verständlich und werden dort interaktiv, wo der klinische Alltag Struktur braucht.",
			eyebrow: "MARKDOWN + MARKDOC",
			frame: {
				ai: {
					badge: "KI-strukturiert",
					inputLabel: "Notiz",
					inputText:
						"110/80 96 38,9°C 99%\ndyspnoe, fieber, produktiver husten seit 3 tagen, keine thoraxschmerzen",
					outputLabel: "Dokumentation",
					outputText:
						"Vorstellung bei seit drei Tagen bestehender Dyspnoe, Fieber und produktivem Husten. Thoraxschmerzen werden verneint.",
					templateIntro: `# Anamnese Notaufnahme

(( Formuliere aus den Notizen eine strukturierte Anamnese. ))`,
					templateLabel: "Vorlage",
					templateVitals: `## Vitalparameter bei Aufnahme am {% info "Datum" type="date" /%}
**RR:** {% info "RR" unit="mmHg" renderUnit=true /%}, **Puls:** {% info "Puls" unit="/min" renderUnit=true /%}, **Temperatur:** {% info "Temperatur" unit="°C" renderUnit=true /%}, **SpO₂:** {% info "SpO2" unit="%" renderUnit=true /%}`,
					title: "notfallaufnahme.md",
					vitals: ["RR 110/80 mmHg", "Puls 96/min", "Temperatur 38,9 °C", "SpO₂ 99 %"],
					vitalsLabel: `Vitalparameter bei Aufnahme am ${CURRENT_LANDING_DATE}`,
				},
				document: {
					badge: "PDF live ausgefüllt",
					consentLabel: "Einwilligung dokumentiert",
					diagnosisInitial: "Kardiologische Rehabilitation",
					diagnosisLabel: "Reha-Indikation",
					documentMeta: "Reha-Antrag · Seite 1/4",
					documentTitle: "Antrag auf medizinische Rehabilitation",
					inputLabel: "Dokumentfelder",
					patientInitial: "Anna Becker",
					patientLabel: "Patientin/Patient",
					previewLabel: "PDF-Vorschau",
					signatureLabel: "Digital vorbereitet",
					title: "reha-antrag.pdf",
				},
				markdown: {
					badge: "Standard-Markdown",
					previewLabel: "Vorschau",
					source: `# Synkope

## Anamnese
Die notfallmäßige Vorstellung erfolgt bei Synkope am **XX.XX.XXXX**. Die Synkope ereignete sich **XX**. Prodromi: **XX**. Fremdanamnese: **XX**.

## San Francisco Syncope Rule
- **C:** Kardiale Vorerkrankung: XX
- **H:** Hb XX g/dl
- **E:** EKG-Auffälligkeiten: XX
- **S:** RR bei Triage XX/XX mmHg
- **S:** Dyspnoe vor oder nach Synkope: XX`,
					sourceLabel: "Markdown",
					title: "synkope.md",
				},
				preview: "Live-Vorschau",
				score: {
					age: {
						initial: "at-least-75",
						label: "Alter",
						options: [
							{ label: "< 65", points: 0, value: "under-65" },
							{ label: "65–74", points: 1, value: "65-to-74" },
							{ label: "≥ 75", points: 2, value: "at-least-75" },
						],
					},
					badge: "Live berechnet",
					content: `# Diagnosen

- **I48.0 – Paroxysmales Vorhofflimmern**
  - CHA₂DS₂-VASc-Score: {% score "CHA₂DS₂-VASc-Score" formula="[Herzinsuffizienz] + [Hypertonie] + [Alter75] * 2 + [Diabetes] + [Schlaganfall] * 2 + [Gefaesserkrankung] + [Alter65] + [Weiblich]" unit="Punkte" renderUnit=true /%}
  - Orale Antikoagulation mit Apixaban
  - Symptomatisch mit Palpitationen und Belastungsdyspnoe`,
					factors: [
						{ initial: false, key: "Herzinsuffizienz", label: "Herzinsuffizienz", points: 1 },
						{ initial: true, key: "Hypertonie", label: "Hypertonie", points: 1 },
						{ initial: true, key: "Diabetes", label: "Diabetes", points: 1 },
						{ initial: false, key: "Schlaganfall", label: "Schlaganfall", points: 2 },
						{
							initial: false,
							key: "Gefaesserkrankung",
							label: "Gefäßerkrankung",
							points: 1,
						},
					],
					gender: {
						initial: "female",
						label: "Geschlecht",
						options: [
							{ label: "Männlich", points: 0, value: "male" },
							{ label: "Weiblich", points: 1, value: "female" },
						],
					},
					inputLabel: "Score-Eingabe",
					outputLabel: "Diagnoseblock",
					title: "diagnoseblock-vorhofflimmern.md",
				},
				template: {
					badge: "Dynamische Vorlage",
					content: `# Elektrische Kardioversion

## Vorbereitung
{% switch "Geschlecht" %}{% case "weiblich" %}Die Patientin{% /case %}{% case "männlich" %}Der Patient{% /case %}{% /switch %} {% info "Nachname" /%} wurde zur elektrischen Kardioversion bei symptomatischem Vorhofflimmern aufgenommen.

Im Vorfeld erfolgte eine TEE ohne Nachweis intrakavitärer Thromben. {% switch "Antikoagulation" %}{% case "sicher" %}Die Antikoagulation wurde sicher eingenommen.{% /case %}{% case "unklar" %}Die Einnahme der Antikoagulation war nicht sicher nachvollziehbar.{% /case %}{% /switch %}

## Durchführung
Nach Sedierung mit Propofol ({% info "Dosis Propofol" type="number" unit="mg" renderUnit=true /%}) erfolgte eine synchronisierte elektrische Kardioversion mit {% info "Joule 1. Schock" type="number" unit="J" renderUnit=true /%} in anterolateraler Elektrodenposition.

## Ergebnis
{% switch "Ergebnis" %}{% case "Sinusrhythmus" %}Erfolgreiche Konversion in den Sinusrhythmus.{% /case %}{% case "Vorhofflimmern" %}Persistierendes Vorhofflimmern nach Kardioversionsversuch.{% /case %}{% /switch %}

Die Patientin oder der Patient war anschließend kardiorespiratorisch stabil; unmittelbare Komplikationen traten nicht auf.`,
					inputLabel: "Kardioversion",
					outputLabel: "Prozedur-Dokumentation",
					title: "elektrische-kardioversion.md",
				},
			},
			steps: {
				ai: {
					description:
						"Aus knappen Stichpunkten entsteht eine lesbare medizinische Dokumentation. Die Vorlage gibt Struktur und Ton vor.",
					detail: "Notizen hinein. Strukturierte Dokumentation heraus.",
					label: "KI-ASSISTENZ",
					number: "04",
					title: "KI ergänzt den Workflow – nicht die Kontrolle.",
				},
				document: {
					description:
						"MDScribe verbindet strukturierte Eingaben mit den passenden Feldern eines ausfüllbaren PDF-Dokuments und macht das Ausfüllen zum Kinderspiel.",
					detail: "Einmal anlegen und in Zukunft die Formulare ganz einfach ausfüllen.",
					label: "DOKUMENTE",
					number: "05",
					title: "PDF-Formulare ausfüllen, genau so leicht wie alles andere.",
				},
				markdown: {
					description:
						"Schreibe einfach so, wie es dir gerade in den Sinn kommt – mit Überschriften, Listen oder Formatierung.",
					detail: "",
					label: "STRUKTUR",
					number: "01",
					title: "Dokumentation beginnt mit lesbaren Vorlagen.",
				},
				score: {
					description:
						"Formeln greifen auf dieselben Eingaben zu und aktualisieren Ergebnisse direkt in der Vorlage.",
					detail: "Werte einmal erfassen, konsistent weiterverwenden.",
					label: "BERECHNUNGEN",
					number: "03",
					title: "Scores werden Teil der Dokumentation.",
				},
				template: {
					description:
						"Mit Markdoc-MD-Tags erstellst du ausfüllbare, wiederverwendbare Vorlagen mit Variablen und Logik.",
					detail: "",
					label: "VARIABLEN + LOGIK",
					number: "02",
					title: "Markdown reagiert auf deine Eingaben.",
				},
			},
			title: "Markdown, das im Klinikalltag mehr kann.",
		},
		footer: {
			brand: "MDScribe",
			github: "GitHub",
			legal: "Impressum und Nutzungsbedingungen",
			tagline: "Open-Source-Werkzeuge für bessere medizinische Dokumentation.",
		},
		hero: {
			demo: {
				diagnosis: "Pneumonie, nicht näher bezeichnet",
				diagnosisCode: "J18.9",
				filename: "notfallaufnahme.md",
				output: `Vorstellung bei seit drei Tagen bestehender Dyspnoe, Fieber und produktivem Husten. Thoraxschmerzen werden verneint.

Vitalparameter bei Aufnahme am ${CURRENT_LANDING_DATE}:
RR 110/80 mmHg, Puls 96/min, Temperatur 38,9 °C, SpO₂ 99 %.`,
				outputLabel: "Dokumentation",
				source: `# Anamnese Notaufnahme

110/80 96 38,9°C 99%

- Dyspnoe seit 3 Tagen
- produktiver Husten
- Fieber 38,9 °C
- keine Thoraxschmerzen`,
				sourceLabel: "Markdown",
			},
			description:
				"MDScribe verbindet KI mit flexiblen Markdown-Vorlagen und macht aus Stichpunkten, Diktaten und Eingaben strukturierte medizinische Dokumentation.",
			githubCta: "Quellcode ansehen",
			primaryCta: "Kostenlos starten",
			primaryCtaAuthenticated: "Dokumentation starten",
			scrollHint: "Scrollen, um MDScribe kennenzulernen",
			titleAccent: "Mehr Medizin.",
			titleLead: "Weniger tippen.",
			trust: ["Open Source", "Anpassbar", "Eigene Modelle"],
		},
		metadata: {
			description:
				"Das Open-Source-Tool MDScribe erleichtert medizinische Dokumentation mit KI, Markdown-Vorlagen und Self-Hosting.",
			title: "MDScribe – Open Source für medizinische Dokumentation",
		},
		pricing: {
			description:
				"Online starten oder auf der eigenen Infrastruktur betreiben. Der klinische Workflow bleibt derselbe.",
			eyebrow: "PASSEND ZU DEINEM SETUP",
			monthly: "Monatlich",
			perMonth: "/ Monat",
			plans: {
				free: {
					caption: "Für immer kostenlos",
					cta: "Kostenlos starten",
					description: "Zum Ausprobieren und Teilen deiner Vorlagen",
					features: [
						"Monatliches KI-Kontingent",
						"Eigene öffentliche Textbausteine",
						"Vorlagen aus der Community",
					],
					name: "MDScribe Free",
					price: "Kostenlos",
				},
				plus: {
					captionMonthly: "Monatlich kündbar",
					captionYearly: "Jährlich abgerechnet",
					cta: "Upgrade zu Plus",
					description: "Für umfangreichere Organisation deiner KI-Funktionen",
					features: [
						"Alle kostenlosen Funktionen",
						"Alle Textbausteine und AI Vorlagen",
						"Erhöhtes monatliches KI-Kontingent",
						"Private Vorlagen",
						"Zero Data Retention bei unterstützten Modellen",
					],
					name: "MDScribe Plus",
					priceMonthly: "9 €",
					priceYearly: "7,50 €",
				},
				selfHosted: {
					caption: "Apache-2.0 · Open Source",
					cta: "Repository öffnen",
					description: "Für deinen klinischen Alltag und volle Datenkontrolle",
					features: [
						"Open Source unter Apache-2.0",
						"Eigene API-Schlüssel",
						"Lokale KI-Modelle",
						"Community Support",
					],
					name: "Self-Hosting",
					price: "Open Source",
				},
			},
			title: "Starte so, wie du arbeiten möchtest.",
			yearly: "Jährlich",
			yearlyDiscount: "−17 %",
		},
		source: {
			benefits: [
				"Open Source unter Apache-2.0",
				"Erweitere MDScribe wie du willst",
				"Eigene API-Schlüssel und lokale Modelle",
			],
			cta: "MDScribe auf GitHub",
			description:
				"Du kannst den Quelltext checken, MDScribe online nutzen oder ganz einfach in deinem Krankenhaus oder deiner Praxis selbst hosten.",
			eyebrow: "KEINE BLACKBOX",
			terminal: {
				command: "git clone https://github.com/ekpah/mdscribe.git",
				license: "Lizenz: Apache-2.0",
				models: "Modelle: eigene Provider oder lokal",
				status: "Bereit für dein Setup.",
			},
			title: "Open Source bis ins Detail. Unter deiner Kontrolle.",
		},
	},
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
