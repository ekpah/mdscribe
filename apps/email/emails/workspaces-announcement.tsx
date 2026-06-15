import { WorkspacesAnnouncementTemplate } from '@repo/email/templates/workspaces-announcement';

const ExampleWorkspacesAnnouncementEmail = () => (
  <WorkspacesAnnouncementTemplate
    actionUrl="https://mdscribe.de/aiscribe"
    buttonText="Brief-Baukasten erstellen"
  />
);

export default ExampleWorkspacesAnnouncementEmail;
