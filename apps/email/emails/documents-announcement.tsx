import { DocumentsAnnouncementTemplate } from '@repo/email/templates/documents-announcement';

const ExampleDocumentsAnnouncementEmail = () => (
  <DocumentsAnnouncementTemplate
    actionUrl="https://mdscribe.de/documents"
    buttonText="Dokumente ansehen"
    userName="Dr. Max Mustermann"
  />
);

export default ExampleDocumentsAnnouncementEmail;
