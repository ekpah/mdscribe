import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { EmailChangeTemplate } from "./templates/change-email";
import { ColdOutreachTemplate } from "./templates/cold-outreach";
import { DocumentsAnnouncementTemplate } from "./templates/documents-announcement";
import { OTPLoginTemplate } from "./templates/otp-login";
import { ResetPasswordTemplate } from "./templates/reset-password";
import { EmailVerificationTemplate } from "./templates/verify";
import { WelcomeTemplate } from "./templates/welcome";

type EmailDraftCategory = "authentication" | "marketing" | "transactional";

interface EmailDraftDefinition {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly category: EmailDraftCategory;
	readonly subject: string;
	readonly previewProps: Record<string, string>;
	readonly render: () => ReactElement;
}

type EmailDraftMetadata = Omit<EmailDraftDefinition, "render">;

const emailDrafts: readonly EmailDraftDefinition[] = [
	{
		category: "marketing",
		description: "Marketingmail zur Dokumente-Funktion mit Rehaantrag-Fokus.",
		id: "documents-announcement",
		previewProps: {
			actionUrl: "https://mdscribe.de/documents",
			buttonText: "Dokumente testen",
			userName: "Dr. Max Mustermann",
		},
		render: () => (
			<DocumentsAnnouncementTemplate
				actionUrl="https://mdscribe.de/documents"
				buttonText="Dokumente testen"
				userName="Dr. Max Mustermann"
			/>
		),
		subject: "Neu: Rehaanträge schneller mit MDScribe vorbereiten",
		title: "Dokumente: Rehaantrag",
	},
	{
		category: "marketing",
		description: "Allgemeine Akquise-Mail für neue MDScribe-Nutzer.",
		id: "cold-outreach",
		previewProps: {
			actionUrl: "https://mdscribe.de/sign-up",
			buttonText: "Jetzt kostenlos starten",
			headline: "70% weniger Dokumentationszeit - KI fuer Assistenzaerzte",
			userName: "Dr. Max Mustermann",
		},
		render: () => (
			<ColdOutreachTemplate
				actionUrl="https://mdscribe.de/sign-up"
				buttonText="Jetzt kostenlos starten"
				headline="70% weniger Dokumentationszeit - KI fuer Assistenzaerzte"
				userName="Dr. Max Mustermann"
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
		render: () => (
			<WelcomeTemplate
				actionUrl="https://mdscribe.de/dashboard"
				buttonText="Zum Dashboard"
				headline="Willkommen bei MDScribe!"
				userName="Max Mustermann"
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
		render: () => (
			<ResetPasswordTemplate url="https://mdscribe.de/reset-password?token=example" />
		),
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

export const renderEmailDraftHtml = async (id: string): Promise<string | null> => {
	const draft = getEmailDraft(id);
	if (!draft) {
		return null;
	}

	return render(draft.render());
};
