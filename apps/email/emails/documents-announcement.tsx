import { DocumentsAnnouncementTemplate } from '@repo/email/templates/documents-announcement';

const ExampleDocumentsAnnouncementEmail = () => (
  <DocumentsAnnouncementTemplate
    actionUrl="https://mdscribe.de/documents"
    buttonText="Dokumente ansehen"
  />
);

export default ExampleDocumentsAnnouncementEmail;
