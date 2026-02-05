import type { DriveStep } from "driver.js";

/**
 * Dashboard tour steps for first-time users
 *
 * These steps guide new users through the main features of MDScribe.
 * Element selectors use data-tour attributes added to dashboard components.
 */
export const dashboardTourSteps: DriveStep[] = [
	{
		element: "[data-tour='welcome']",
		popover: {
			title: "Willkommen bei MDScribe!",
			description:
				"Lassen Sie uns einen kurzen Rundgang durch die wichtigsten Funktionen machen. Dies dauert nur eine Minute.",
			side: "bottom",
			align: "start",
		},
	},
	{
		element: "[data-tour='quick-stats']",
		popover: {
			title: "Ihre Statistiken",
			description:
				"Hier sehen Sie auf einen Blick Ihre Favoriten, erstellten Templates und verfügbaren KI-Generierungen pro Monat.",
			side: "bottom",
			align: "center",
		},
	},
	{
		element: "[data-tour='ai-functions']",
		popover: {
			title: "KI-Funktionen",
			description:
				"Wählen Sie aus verschiedenen KI-gestützten Dokumentationstypen: Notfall-Anamnese, Entlassungsbriefe, Prozedur-Dokumentation und mehr.",
			side: "top",
			align: "center",
		},
	},
	{
		element: "[data-tour='ai-start-button']",
		popover: {
			title: "KI starten",
			description:
				"Klicken Sie hier, um direkt mit der KI-gestützten Dokumentation zu beginnen.",
			side: "bottom",
			align: "end",
		},
	},
	{
		element: "[data-tour='favorites']",
		popover: {
			title: "Ihre Favoriten",
			description:
				"Speichern Sie häufig verwendete Templates als Favoriten für schnellen Zugriff. Sie erscheinen hier auf Ihrem Dashboard.",
			side: "top",
			align: "start",
		},
	},
	{
		element: "[data-tour='activity']",
		popover: {
			title: "Letzte Aktivität",
			description:
				"Verfolgen Sie Ihre neuesten Aktionen und greifen Sie schnell auf Ihre eigenen Templates zu.",
			side: "left",
			align: "start",
		},
	},
	{
		element: "[data-tour='profile-button']",
		popover: {
			title: "Profil & Einstellungen",
			description:
				"Verwalten Sie Ihr Profil, Abonnement und persönliche Einstellungen.",
			side: "bottom",
			align: "end",
		},
	},
	{
		popover: {
			title: "Bereit loszulegen!",
			description:
				"Sie können diese Tour jederzeit über Ihr Profil erneut starten. Viel Erfolg mit MDScribe!",
		},
	},
];

/**
 * Keyboard shortcuts info for power users
 * Can be triggered separately from main tour
 */
export const keyboardShortcutsTourSteps: DriveStep[] = [
	{
		popover: {
			title: "Tastenkürzel",
			description:
				"MDScribe unterstützt verschiedene Tastenkürzel für schnelleres Arbeiten.",
		},
	},
	{
		popover: {
			title: "Generieren: ⌘/Ctrl + Enter",
			description:
				"Drücken Sie ⌘+Enter (Mac) oder Ctrl+Enter (Windows), um eine KI-Generierung zu starten.",
		},
	},
	{
		popover: {
			title: "Textbausteine: Shift + F2",
			description:
				"Öffnen Sie Ihre persönlichen Textbausteine mit Shift+F2 für schnelles Einfügen.",
		},
	},
	{
		popover: {
			title: "Eingabe fokussieren: ⌘/Ctrl + Shift + 1",
			description: "Springen Sie direkt zum Eingabefeld mit diesem Kürzel.",
		},
	},
];
