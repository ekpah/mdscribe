import { AiTextsAnnouncementTemplate } from "@repo/email/templates/ai-texts-announcement";

const ExampleAiTextsAnnouncementEmail = () => (
	<AiTextsAnnouncementTemplate
		actionUrl="https://mdscribe.de/profile/ai-scribe"
		buttonText="AI Textbaustein erstellen"
		templateButtonText="Template erstellen"
		templateUrl="https://mdscribe.de/templates/create"
	/>
);

export default ExampleAiTextsAnnouncementEmail;
