import { ColdOutreachTemplate } from '@repo/email/templates/cold-outreach';

const ExampleColdOutreachEmail = () => (
    <ColdOutreachTemplate
        actionUrl="https://mdscribe.de/sign-up"
        buttonText="Jetzt kostenlos starten"
        headline="🚀 70% weniger Dokumentationszeit – KI für Assistenzärzte"
        userName="Dr. Max Mustermann"
    />
);

export default ExampleColdOutreachEmail;
