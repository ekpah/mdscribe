import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import config from '../tailwind.config';

interface WorkspacesAnnouncementTemplateProps {
  readonly userName?: string | undefined;
  readonly actionUrl: string;
  readonly headline?: string;
  readonly buttonText?: string;
  readonly previewText?: string;
}

export const WorkspacesAnnouncementTemplate = ({
  userName,
  actionUrl,
  headline = 'Neu: Eigene Brief-Baukästen mit KI-Agent',
  buttonText = 'Brief-Baukasten erstellen',
  previewText = 'Stelle Dir eigene Arztbrief-Editoren aus Deinen AI Vorlagen zusammen und überarbeite sie im Dialog mit dem Agenten.',
}: WorkspacesAnnouncementTemplateProps) => {
  const greeting = userName ? `Hallo ${userName},` : 'Hallo,';

  return (
    <Tailwind config={config}>
      <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body className="bg-background font-sans">
          <Container className="mx-auto py-12">
            <Section className="mt-8 rounded-md bg-muted p-px">
              <Section className="rounded-[5px] bg-card p-8">
                <Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
                  {headline}
                </Text>
                <Section className="mb-6 rounded-md bg-background p-4">
                  <Row>
                    <Column className="w-[56%] pr-3 align-top">
                      <Section className="rounded-md border border-border bg-card p-4">
                        <Text className="m-0 font-semibold text-foreground text-sm">
                          Brief-Baukasten · Entlassbrief
                        </Text>
                        <Text className="m-0 text-muted-foreground text-xs">
                          aus Deinen AI Vorlagen zusammengestellt
                        </Text>
                        <Section className="mt-4 rounded-sm border border-border p-2">
                          <Text className="m-0 text-muted-foreground text-xs">
                            Diagnosen
                          </Text>
                          <Section className="mt-1 h-2 rounded-sm bg-primary" />
                        </Section>
                        <Section className="mt-2 rounded-sm border border-border p-2">
                          <Text className="m-0 text-muted-foreground text-xs">
                            Anamnese
                          </Text>
                          <Section className="mt-1 h-2 w-[82%] rounded-sm bg-primary" />
                        </Section>
                        <Section className="mt-2 rounded-sm border border-border p-2">
                          <Text className="m-0 text-muted-foreground text-xs">
                            Epikrise
                          </Text>
                          <Section className="mt-1 h-2 w-[68%] rounded-sm bg-primary" />
                        </Section>
                      </Section>
                    </Column>
                    <Column className="w-[44%] pl-3 align-top">
                      <Section className="rounded-md bg-muted p-3 text-center">
                        <Text className="m-0 text-3xl text-foreground">🤖</Text>
                        <Text className="m-0 font-semibold text-foreground text-sm">
                          Agent
                        </Text>
                        <Text className="mb-3 text-muted-foreground text-xs">
                          "Ergänze den neuen CRP-Wert in den Befunden."
                        </Text>
                        <Text className="m-0 text-2xl text-foreground">↓</Text>
                        <Text className="m-0 font-semibold text-foreground text-sm">
                          Vorschlag
                        </Text>
                        <Text className="mb-0 text-muted-foreground text-xs">
                          Abschnitt wird neu erzeugt – Du prüfst und übernimmst.
                        </Text>
                      </Section>
                    </Column>
                  </Row>
                </Section>
                <Text className="m-0 text-muted-foreground">{greeting}</Text>
                <Text className="text-muted-foreground">
                  ein Arztbrief besteht aus wiederkehrenden Bausteinen –
                  Diagnosen, Anamnese, Befunde, Epikrise. Mit dem neuen
                  Brief-Baukasten stellst Du Dir daraus eigene Editoren zusammen:
                  Für jeden Abschnitt wählst Du die AI Vorlage mit dem passenden
                  Prompt, und MDScribe baut daraus eine durchgängige
                  Dokumentationsumgebung.
                </Text>
                <Text className="font-bold text-lg text-muted-foreground">
                  Zwei Dinge sind neu
                </Text>
                <Section>
                  <Row>
                    <Column className="w-[50%] pr-2 align-top">
                      <Section className="rounded-md bg-muted p-3">
                        <Text className="m-0 font-semibold text-foreground text-sm">
                          Selbst zusammenstellen
                        </Text>
                        <Text className="mb-0 text-muted-foreground text-xs">
                          Lege fest, welche AI Vorlage jeden Abschnitt erzeugt –
                          passend zu Deiner Fachrichtung und Deinem Setting.
                        </Text>
                      </Section>
                    </Column>
                    <Column className="w-[50%] pl-2 align-top">
                      <Section className="rounded-md bg-muted p-3">
                        <Text className="m-0 font-semibold text-foreground text-sm">
                          Mit dem Agenten überarbeiten
                        </Text>
                        <Text className="mb-0 text-muted-foreground text-xs">
                          Diktiere oder beschreibe eine Änderung – der Agent
                          generiert oder bearbeitet den passenden Abschnitt als
                          Vorschlag.
                        </Text>
                      </Section>
                    </Column>
                  </Row>
                </Section>
                <Text className="text-muted-foreground">
                  Der Agent kennt den gesamten Brief als Kontext: Er kann einen
                  Abschnitt komplett neu erzeugen oder gezielt eine Stelle
                  ändern. Jede Änderung erscheint als Vorschlag im Editor, den Du
                  per Diff annimmst oder verwirfst – nichts wird ungefragt
                  überschrieben.
                </Text>
                <Text className="text-muted-foreground">
                  Die Funktion ist noch in Entwicklung. Probiere sie früh aus und
                  sag uns, welche Brief-Bausteine in Deinem Alltag am meisten
                  Zeit kosten.
                </Text>
                <Hr className="my-4" />
                <Button
                  className="rounded-md bg-primary px-6 py-3 font-semibold text-lg text-primary-foreground"
                  href={actionUrl}
                >
                  {buttonText}
                </Button>
                <Hr className="my-4" />
                <Text className="m-0 text-muted-foreground text-sm">
                  Viele Grüße,
                  <br />
                  das MDScribe-Team
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};
