'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';

export default function LegalPage() {
  return (
    <div className="h-full w-full space-y-8">
      {/* Impressum section always visible at the top */}
      <section className="space-y-6">
        <h2 className="font-semibold text-xl">Impressum</h2>
        <div className="space-y-4">
          <h3 className="font-semibold">Angaben gemäß § 5 TMG</h3>
          <div className="space-y-2">
            <p>Dr. med. Nils Hapke</p>
            <p>Huttenstraße 6</p>
            <p>97072 Würzburg</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Kontakt</h3>
          <div className="space-y-2">
            <p>E-Mail: nils.hapke@we-mail.de</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Streitschlichtung</h3>
          <p>
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:
            https://ec.europa.eu/consumers/odr/
          </p>
        </div>
      </section>

      {/* Tabs for Datenschutz and AGB */}
      <Tabs defaultValue="datenschutz" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="datenschutz">Datenschutzerklärung</TabsTrigger>
          <TabsTrigger value="agb">Geschäftsbedingungen</TabsTrigger>
        </TabsList>

        <TabsContent value="datenschutz" className="space-y-8">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">Stand: 17.04.2025</p>
              <p className="text-muted-foreground">
                Wir freuen uns über Ihr Interesse an mdscribe.de. Der Schutz
                Ihrer personenbezogenen Daten ist uns ein wichtiges Anliegen.
                Nachfolgend informieren wir Sie über die Art, den Umfang und den
                Zweck der Verarbeitung personenbezogener Daten auf unserer
                Website gemäß den Vorgaben der Datenschutz-Grundverordnung
                (DSGVO).
              </p>
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">1. Verantwortlicher</h3>
              <div className="space-y-2">
                <p>
                  Verantwortlich für die Datenverarbeitung auf dieser Website
                  ist:
                </p>
                <p>Dr. med. Nils Hapke</p>
                <p>Huttenstraße 6</p>
                <p>97072 Würzburg</p>
                <p>E-Mail: nils.hapke@we-mail.de</p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                2. Datenverarbeitung beim Besuch der Website
              </h3>
              <div className="space-y-4">
                <p>
                  Beim Aufruf unserer Website werden automatisch Informationen
                  durch den Webserver erfasst. Diese sogenannten Server-Logfiles
                  können folgende Daten enthalten:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>IP-Adresse (gekürzt oder anonymisiert gespeichert)</li>
                  <li>Datum und Uhrzeit der Anfrage</li>
                  <li>aufgerufene Seite/Datei</li>
                  <li>Browsertyp und Version</li>
                  <li>verwendetes Betriebssystem</li>
                  <li>Referrer-URL (sofern übermittelt)</li>
                </ul>
                <p>
                  Diese Daten dienen der technischen Überwachung, der Stabilität
                  und Sicherheit der Website. Eine Zusammenführung mit anderen
                  Datenquellen oder eine Profilbildung erfolgt nicht.
                </p>
                <p>
                  Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
                  Interesse)
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                3. Registrierung und Nutzerkonto
              </h3>
              <div className="space-y-2">
                <p>
                  Für die Nutzung erweiterter Funktionen können Sie sich auf
                  mdscribe.de registrieren. Dabei werden folgende Daten
                  verarbeitet:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Name (frei wählbar)</li>
                  <li>E-Mail-Adresse</li>
                  <li>Passwort (verschlüsselt gespeichert)</li>
                </ul>
                <p>
                  Bei der Registrierung stimmen Sie dieser Datenschutzerklärung
                  ausdrücklich zu.
                </p>
                <p>
                  Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
                  (Vertragserfüllung), Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                4. Aktivitätsverfolgung (Tracking ohne Cookies)
              </h3>
              <div className="space-y-2">
                <p>
                  Zur Sicherstellung der Funktionalität und zur Optimierung der
                  Services wird die Nutzung der Plattform intern protokolliert
                  (z. B. welche Funktionen wie häufig genutzt werden). Dies
                  erfolgt ohne externe Analyse-Tools und ohne Tracking-Cookies.
                </p>
                <p>Die erfassten Daten sind:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Nutzungszeitpunkt</li>
                  <li>Art der genutzten Funktion</li>
                  <li>anonyme Session-Kennung</li>
                </ul>
                <p>
                  Diese Daten werden ausschließlich intern verwendet, um die
                  Plattform zu verbessern und Missbrauch zu verhindern.
                </p>
                <p>
                  Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
                  Interesse)
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                5. Eingaben auf der Plattform
              </h3>
              <div className="space-y-2">
                <p>
                  Die Plattform dient der Eingabe anonymisierter Stichpunkte
                  oder Daten, jedoch nicht von personenbezogenen
                  Gesundheitsdaten. Nutzer sind verpflichtet, keine
                  personenbezogenen Gesundheitsdaten einzugeben.
                </p>
                <p>
                  Bitte beachten Sie: mdscribe.de ist nicht als medizinisches
                  Informationssystem zugelassen.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">6. Speicherdauer</h3>
              <div className="space-y-2">
                <p>
                  Die bei der Registrierung angegebenen Daten werden so lange
                  gespeichert, wie das Nutzerkonto aktiv ist. Nach Löschung des
                  Kontos werden personenbezogene Daten innerhalb von 30 Tagen
                  gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten
                  entgegenstehen.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">7. Weitergabe von Daten</h3>
              <div className="space-y-2">
                <p>
                  Eine Weitergabe Ihrer personenbezogenen Daten an Dritte
                  erfolgt nicht, es sei denn:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Sie haben ausdrücklich eingewilligt</li>
                  <li>
                    dies ist zur Erfüllung gesetzlicher Pflichten erforderlich
                  </li>
                  <li>
                    dies ist zur Durchsetzung unserer Rechte notwendig (z. B.
                    bei Missbrauch)
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">8. Ihre Rechte</h3>
              <div className="space-y-2">
                <p>Sie haben das Recht:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>auf Auskunft gemäß Art. 15 DSGVO</li>
                  <li>auf Berichtigung gemäß Art. 16 DSGVO</li>
                  <li>auf Löschung gemäß Art. 17 DSGVO</li>
                  <li>
                    auf Einschränkung der Verarbeitung gemäß Art. 18 DSGVO
                  </li>
                  <li>auf Datenübertragbarkeit gemäß Art. 20 DSGVO</li>
                  <li>
                    auf Widerspruch gegen die Verarbeitung gemäß Art. 21 DSGVO
                  </li>
                  <li>
                    auf Widerruf einer Einwilligung gemäß Art. 7 Abs. 3 DSGVO
                  </li>
                  <li>
                    auf Beschwerde bei einer Aufsichtsbehörde gemäß Art. 77
                    DSGVO
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">9. Datensicherheit</h3>
              <div className="space-y-2">
                <p>
                  Wir setzen geeignete technische und organisatorische Maßnahmen
                  ein, um Ihre Daten vor Verlust, Missbrauch und unbefugtem
                  Zugriff zu schützen. Die Datenübertragung erfolgt über eine
                  verschlüsselte Verbindung (SSL/TLS).
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                10. Änderungen dieser Datenschutzerklärung
              </h3>
              <div className="space-y-2">
                <p>
                  Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf
                  anzupassen, insbesondere bei technischen Änderungen oder neuen
                  gesetzlichen Anforderungen. Die jeweils aktuelle Version ist
                  jederzeit auf mdscribe.de abrufbar.
                </p>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="agb" className="space-y-8">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">Stand: 17.04.2025</p>
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold text-xl">
                Allgemeine Geschäftsbedingungen (AGB) für mdscribe.de
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">1. Geltungsbereich</h4>
                  <p>
                    Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die
                    Nutzung der Website mdscribe.de (im Folgenden „Plattform"),
                    betrieben von Dr. med. Nils Hapke. Sie regeln das Verhältnis
                    zwischen dem Anbieter und den registrierten sowie nicht
                    registrierten Nutzern der Plattform.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">2. Leistungen von mdscribe.de</h4>
                  <p className="font-medium text-sm">
                    2.1 Unregistrierte Nutzung (kostenfrei)
                  </p>
                  <p>
                    Nutzer können die öffentlich zugänglichen Textbausteine auf
                    der Plattform kostenlos und ohne Registrierung durchsuchen
                    und nutzen. Es besteht kein Anspruch auf Verfügbarkeit oder
                    Vollständigkeit.
                  </p>
                  <p className="font-medium text-sm">
                    2.2 Registrierung (kostenfrei)
                  </p>
                  <p>
                    Registrierte Nutzer können eigene Textbausteine erstellen,
                    speichern und verwalten. Die Registrierung ist kostenlos.
                    Ein Anspruch auf Registrierung oder dauerhafte Nutzung
                    besteht nicht.
                  </p>
                  <p className="font-medium text-sm">
                    2.3 Erweiterte Funktionen im Rahmen eines Abonnements
                    (kostenpflichtig)
                  </p>
                  <p>
                    Registrierte Nutzer haben die Möglichkeit, ein
                    kostenpflichtiges Abonnement abzuschließen. Dieses
                    ermöglicht den Zugang zu KI-basierten Funktionen zur
                    Erstellung medizinischer Dokumentation. Die genauen Inhalte
                    und Preise sind auf der Website einsehbar.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">3. Vertragsabschluss</h4>
                  <p>
                    Mit der Registrierung oder dem Abschluss eines Abonnements
                    erkennt der Nutzer diese AGB an. Der Vertrag über das
                    Abonnement kommt durch die Bestellung des Nutzers und die
                    Bestätigung durch mdscribe.de zustande.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">4. Nutzungsrechte</h4>
                  <p>
                    Die Inhalte und Funktionen von mdscribe.de dürfen
                    ausschließlich für private, nicht-kommerzielle oder
                    berufliche Zwecke im Rahmen ärztlicher Tätigkeit genutzt
                    werden. Die kommerzielle Weiterverwertung der Textbausteine
                    oder generierten Texte ohne ausdrückliche Zustimmung des
                    Anbieters ist untersagt.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">5. Pflichten der Nutzer</h4>
                  <p>
                    Nutzer verpflichten sich, bei der Registrierung
                    wahrheitsgemäße Angaben zu machen. Die Zugangsdaten sind
                    vertraulich zu behandeln und dürfen nicht an Dritte
                    weitergegeben werden. Es dürfen keine personenbezogenen
                    Gesundheitsdaten auf der Plattform eingegeben werden.
                    Erlaubt sind nur anonymisierte Inhalte und Stichpunkte. Ein
                    Verstoß gegen diese Pflichten kann zur sofortigen Sperrung
                    des Accounts führen.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">
                    6. Verfügbarkeit und Änderungen
                  </h4>
                  <p>
                    mdscribe.de bemüht sich um eine hohe Verfügbarkeit der
                    Plattform, kann dies aber nicht garantieren. Der Anbieter
                    behält sich das Recht vor, Funktionen zu ändern,
                    einzuschränken oder ganz einzustellen. Abonnenten werden im
                    Falle wesentlicher Änderungen rechtzeitig informiert.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">7. Laufzeit und Kündigung</h4>
                  <p>
                    Kostenpflichtige Abonnements haben die jeweils gewählte
                    Laufzeit (z. B. monatlich oder jährlich) und verlängern sich
                    automatisch, sofern sie nicht fristgerecht vor Ablauf
                    gekündigt werden. Eine Kündigung kann über die
                    Kontoeinstellungen erfolgen.
                  </p>
                  <p>
                    Kostenlose Konten können jederzeit ohne Angabe von Gründen
                    gelöscht werden.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">8. Haftung</h4>
                  <p>
                    Die Inhalte auf mdscribe.de dienen ausschließlich als
                    Hilfestellung bei der medizinischen Dokumentation. Sie
                    stellen keine medizinische Beratung dar. Für die
                    Richtigkeit, Vollständigkeit oder Anwendbarkeit der
                    generierten Inhalte übernimmt mdscribe.de keine Haftung.
                  </p>
                  <p>
                    Eine Haftung für leichte Fahrlässigkeit ist ausgeschlossen,
                    außer bei Verletzung wesentlicher Vertragspflichten, bei
                    Schäden aus der Verletzung des Lebens, des Körpers oder der
                    Gesundheit sowie nach dem Produkthaftungsgesetz.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">9. Datenschutz</h4>
                  <p>
                    Die Verarbeitung personenbezogener Daten erfolgt gemäß der
                    auf der Website einsehbaren Datenschutzerklärung. Mit der
                    Nutzung der Plattform erklärt sich der Nutzer mit dieser
                    einverstanden.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">10. Änderungen der AGB</h4>
                  <p>
                    Der Anbieter behält sich vor, diese AGB bei Bedarf
                    anzupassen. Nutzer werden über Änderungen rechtzeitig
                    informiert. Widerspricht ein registrierter Nutzer der
                    Änderung nicht innerhalb von 14 Tagen, gelten die neuen AGB
                    als akzeptiert.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">11. Schlussbestimmungen</h4>
                  <p>
                    Es gilt das Recht der Bundesrepublik Deutschland.
                    Gerichtsstand für alle Streitigkeiten aus diesem Vertrag
                    ist, soweit gesetzlich zulässig, der Sitz des Anbieters.
                  </p>
                  <p>
                    Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise
                    unwirksam sein, bleibt die Wirksamkeit der übrigen
                    Bestimmungen unberührt.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/*
Diese Plattform dient ausschließlich dem Informationsaustausch zwischen Behandlungspartnern im Rahmen der Akut- und Notfallmedizin.

Rechtlich verantwortlich ist ausschließlich der Nutzer der Plattform. Der Plattformbetreiber haftet nicht für etwaige Rechtsverletzungen im Zusammenhang mit der Nutzung dieser Plattform. Das Hochladen von Inhalten, die nicht im Zusammenhang mit der notfallmedizinischen Versorgung von Patienten stehen, ist untersagt.

Beim Hochladen sind die Persönlichkeitsrechte und Datenschutzrechte der Patienten zu wahren. Es dürfen nur Dokumente hochgeladen werden, die keine Rückschlüsse auf die abgebildeten Personen zulassen. Der Nutzer verpflichtet sich dazu, keine personenbezogenen Daten gem. Art. 4 DSGVO über die Plattform zu verarbeiten und stellt ggf. eine Anonymisierung durch geeignete Maßnahmen sicher. Sollten Teile eines Dokumentes einen Bezug zu Personen enthalten, so müssen diese Stellen mit der Funktion "Bild bearbeiten" geschwärzt und damit unkenntlich gemacht werden. Für die in den hochgeladenen Dokumenten vorhandenen datenschutzrelevanten Inhalte trägt alleine der Nutzer die rechtliche Verantwortung.

Die IP-Adresse des Nutzers wird lediglich zur Nachverfolgung bei missbräuchlichem Gebrauch dieser Plattform gespeichert.
*/
