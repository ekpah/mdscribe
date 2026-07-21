import { render } from "@react-email/components";
import type { ReactElement } from "react";

import { AiTextsAnnouncementTemplate } from "./templates/ai-texts-announcement";
import { EmailChangeTemplate } from "./templates/change-email";
import { ColdOutreachTemplate } from "./templates/cold-outreach";
import { ContextTransferAnnouncementTemplate } from "./templates/context-transfer-announcement";
import { DocumentsAnnouncementTemplate } from "./templates/documents-announcement";
import { OTPLoginTemplate } from "./templates/otp-login";
import { ResetPasswordTemplate } from "./templates/reset-password";
import { TemplateInformationAnnouncementTemplate } from "./templates/template-information-announcement";
import { EmailVerificationTemplate } from "./templates/verify";
import { WelcomeTemplate } from "./templates/welcome";
import { WorkspacesAnnouncementTemplate } from "./templates/workspaces-announcement";

type EmailDraftCategory = "authentication" | "marketing" | "transactional";

interface EmailDraftRecipient {
	readonly email: string;
	readonly name: string | null;
}

interface EmailDraftRenderContext {
	readonly recipient?: EmailDraftRecipient;
}

interface EmailDraftDefinition {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly category: EmailDraftCategory;
	readonly subject: string;
	readonly previewProps: Record<string, string>;
	readonly render: (context?: EmailDraftRenderContext) => ReactElement;
}

type EmailDraftMetadata = Omit<EmailDraftDefinition, "render">;

const getRecipientName = (
	context: EmailDraftRenderContext | undefined,
	previewUserName?: string,
): string | undefined => {
	if (context?.recipient) {
		return context.recipient.name?.trim() || undefined;
	}

	return previewUserName;
};

const emailDrafts: readonly EmailDraftDefinition[] = [
	{
		category: "marketing",
		description: "Marketingmail zum Informationen-Feld für Templates und Dokumente.",
		id: "template-information-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/templates/create",
			buttonText: "Informationen hinzufügen",
		},
		render: () => (
			<TemplateInformationAnnouncementTemplate
				actionUrl="https://mdscribe.de/templates/create"
				buttonText="Informationen hinzufügen"
			/>
		),
		subject: "Neu: Eigene Vorgaben für Templates und Dokumente",
		title: "Templates & Dokumente: Informationen",
	},
	{
		category: "marketing",
		description: "Marketingmail zur Weiterverwenden-Funktion für sichere Kontextübergabe.",
		id: "context-transfer-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/aiscribe",
			buttonText: "AIScribe öffnen",
		},
		render: () => (
			<ContextTransferAnnouncementTemplate
				actionUrl="https://mdscribe.de/aiscribe"
				buttonText="AIScribe öffnen"
			/>
		),
		subject: "Neu: Kontext in MDScribe weiterverwenden",
		title: "AIScribe: Weiterverwenden",
	},
	{
		category: "marketing",
		description: "Marketingmail zu AI Textbausteinen als anpassbare AIScribe-Vorlagen.",
		id: "ai-texts-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/profile/ai-scribe",
			buttonText: "AI Textbaustein erstellen",
			templateButtonText: "Template erstellen",
			templateUrl: "https://mdscribe.de/templates/create",
		},
		render: () => (
			<AiTextsAnnouncementTemplate
				actionUrl="https://mdscribe.de/profile/ai-scribe"
				buttonText="AI Textbaustein erstellen"
				templateButtonText="Template erstellen"
				templateUrl="https://mdscribe.de/templates/create"
			/>
		),
		subject: "Neu: AI Textbausteine für spezialisierte Vorlagen",
		title: "AI-Scribe: AI Textbausteine",
	},
	{
		category: "marketing",
		description: "Marketingmail zur Dokumente-Funktion mit Rehaantrag-Fokus.",
		id: "documents-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/documents",
			buttonText: "Dokumente testen",
		},
		render: (context) => (
			<DocumentsAnnouncementTemplate
				actionUrl="https://mdscribe.de/documents"
				buttonText="Dokumente testen"
				userName={getRecipientName(context)}
			/>
		),
		subject: "Neu: Rehaanträge schneller mit MDScribe vorbereiten",
		title: "Dokumente: Rehaantrag",
	},
	{
		category: "marketing",
		description:
			"Marketingmail zum Brief-Baukasten: eigene Editoren aus AI Vorlagen plus Überarbeitung mit dem KI-Agenten.",
		id: "workspaces-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/aiscribe",
			buttonText: "Brief-Baukasten erstellen",
		},
		render: (context) => (
			<WorkspacesAnnouncementTemplate
				actionUrl="https://mdscribe.de/aiscribe"
				buttonText="Brief-Baukasten erstellen"
				userName={getRecipientName(context)}
			/>
		),
		subject: "Neu: Eigene Brief-Baukästen mit KI-Agent",
		title: "Brief-Baukasten & Agent",
	},
	{
		category: "marketing",
		description: "Allgemeine Akquise-Mail für neue MDScribe-Nutzer.",
		id: "cold-outreach",
		previewProps: {
			actionUrl: "https://mdscribe.de/sign-up",
			buttonText: "Jetzt kostenlos starten",
			headline: "70% weniger Dokumentationszeit - KI fuer Assistenzaerzte",
		},
		render: (context) => (
			<ColdOutreachTemplate
				actionUrl="https://mdscribe.de/sign-up"
				buttonText="Jetzt kostenlos starten"
				headline="70% weniger Dokumentationszeit - KI fuer Assistenzaerzte"
				userName={getRecipientName(context)}
			/>
		),
		subject: "70% weniger Dokumentationszeit mit MDScribe",
		title: "Cold Outreach",
	},
	{
		category: "transactional",
		description: "Begrüßungsmail nach erfolgreicher Registrierung.",
		id: "welcome",
		previewProps: {
			actionUrl: "https://mdscribe.de/dashboard",
			buttonText: "Zum Dashboard",
			headline: "Willkommen bei MDScribe!",
			userName: "Max Mustermann",
		},
		render: (context) => (
			<WelcomeTemplate
				actionUrl="https://mdscribe.de/dashboard"
				buttonText="Zum Dashboard"
				headline="Willkommen bei MDScribe!"
				userName={getRecipientName(context, "Max Mustermann")}
			/>
		),
		subject: "Willkommen bei MDScribe",
		title: "Willkommen",
	},
	{
		category: "authentication",
		description: "Bestätigung der E-Mail-Adresse nach Registrierung oder Login.",
		id: "verify",
		previewProps: {
			url: "https://mdscribe.de/email-verified?token=example",
		},
		render: () => (
			<EmailVerificationTemplate url="https://mdscribe.de/email-verified?token=example" />
		),
		subject: "Verify your email address",
		title: "E-Mail bestätigen",
	},
	{
		category: "authentication",
		description: "Passwort-zurücksetzen-Mail mit sicherem Link.",
		id: "reset-password",
		previewProps: {
			url: "https://mdscribe.de/reset-password?token=example",
		},
		render: () => <ResetPasswordTemplate url="https://mdscribe.de/reset-password?token=example" />,
		subject: "Setze dein Passwort zurück",
		title: "Passwort zurücksetzen",
	},
	{
		category: "authentication",
		description: "Bestätigung einer angefragten E-Mail-Adressänderung.",
		id: "change-email",
		previewProps: {
			newEmail: "neu@example.com",
			url: "https://mdscribe.de/dashboard?changeEmailToken=example",
		},
		render: () => (
			<EmailChangeTemplate
				newEmail="neu@example.com"
				url="https://mdscribe.de/dashboard?changeEmailToken=example"
			/>
		),
		subject: "Genehmige E-Mail-Änderung",
		title: "E-Mail ändern",
	},
	{
		category: "authentication",
		description: "Einmalcode für einen Login per E-Mail.",
		id: "otp-login",
		previewProps: {
			expiryTime: "10 Minuten",
			headline: "Ihr Login-Code",
			otpCode: "123456",
			text: "Verwenden Sie den folgenden Code, um sich anzumelden:",
		},
		render: () => (
			<OTPLoginTemplate
				expiryTime="10 Minuten"
				headline="Ihr Login-Code"
				otpCode="123456"
				text="Verwenden Sie den folgenden Code, um sich anzumelden:"
			/>
		),
		subject: "Dein Login-Code",
		title: "OTP Login",
	},
];

export const emailDraftIds = emailDrafts.map((draft) => draft.id);

export const getEmailDraft = (id: string): EmailDraftDefinition | undefined =>
	emailDrafts.find((draft) => draft.id === id);

export const listEmailDraftMetadata = (): EmailDraftMetadata[] =>
	emailDrafts.map(({ render: _render, ...metadata }) => metadata);

export const renderEmailDraftHtml = (id: string): Promise<string | null> => {
	const draft = getEmailDraft(id);
	if (!draft) {
		return Promise.resolve(null);
	}

	return render(draft.render());
};
