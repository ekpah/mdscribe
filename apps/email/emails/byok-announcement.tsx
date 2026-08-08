import { ByokAnnouncementTemplate } from "@repo/email/templates/byok-announcement";

export default function ByokAnnouncementEmail() {
	return (
		<ByokAnnouncementTemplate
			actionUrl="https://mdscribe.de/profile/ai-access"
			buttonText="Eigenen API-Schlüssel hinterlegen"
		/>
	);
}
