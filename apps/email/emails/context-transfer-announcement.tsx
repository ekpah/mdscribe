import { ContextTransferAnnouncementTemplate } from "@repo/email/templates/context-transfer-announcement";

export default function ContextTransferAnnouncementEmail() {
	return (
		<ContextTransferAnnouncementTemplate
			actionUrl="https://mdscribe.de/aiscribe"
			buttonText="AIScribe öffnen"
		/>
	);
}
