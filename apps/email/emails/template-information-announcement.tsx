import { TemplateInformationAnnouncementTemplate } from "@repo/email/templates/template-information-announcement";

export default function TemplateInformationAnnouncementEmail() {
	return (
		<TemplateInformationAnnouncementTemplate
			actionUrl="https://mdscribe.de/templates/create"
			buttonText="Informationen hinzufügen"
		/>
	);
}
