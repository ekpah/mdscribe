export default function ImpressumPage() {
  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-xl">Impressum</h2>

      <section className="space-y-4">
        <h3 className="font-semibold">Angaben gemäß § 5 TMG</h3>
        <div className="space-y-2">
          <p>Dr. med. Nils Hapke</p>
          <p>Huttenstraße 6</p>
          <p>97072 Würzburg</p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Kontakt</h3>
        <div className="space-y-2">
          <p>E-Mail: nils.hapke@we-mail.de</p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Streitschlichtung</h3>
        <p>
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:
          https://ec.europa.eu/consumers/odr/
        </p>
      </section>
      <div className="space-y-8">
        <h2 className="font-semibold text-xl">Datenschutzerklärung</h2>

        <section className="space-y-4">
          <h3 className="font-semibold">1. Datenschutz auf einen Blick</h3>
          <div className="space-y-2">
            <h4 className="font-medium">Allgemeine Hinweise</h4>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber,
              was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
              Website besuchen. Personenbezogene Daten sind alle Daten, mit
              denen Sie persönlich identifiziert werden können.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">
            2. Allgemeine Hinweise und Pflichtinformationen
          </h3>
          <div className="space-y-2">
            <h4 className="font-medium">Datenschutz</h4>
            <p>
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen
              Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten
              vertraulich und entsprechend der gesetzlichen
              Datenschutzvorschriften sowie dieser Datenschutzerklärung.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">
            3. Datenerfassung auf dieser Website
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Cookies</h4>
              <p>
                Unsere Website verwendet Cookies. Das sind kleine Textdateien,
                die Ihr Webbrowser auf Ihrem Endgerät speichert. Cookies helfen
                uns dabei, unser Angebot nutzerfreundlicher, effektiver und
                sicherer zu machen.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Server-Log-Dateien</h4>
              <p>
                Der Provider der Seiten erhebt und speichert automatisch
                Informationen in so genannten Server-Log-Dateien, die Ihr
                Browser automatisch an uns übermittelt.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">4. Analyse-Tools und Werbung</h3>
          <p>
            Wir nutzen keine Analyse-Tools oder Werbenetzwerke auf dieser
            Website.
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">5. Plugins und Tools</h3>
          <div className="space-y-2">
            <h4 className="font-medium">Web Fonts</h4>
            <p>
              Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten
              so genannte Web Fonts. Beim Aufruf einer Seite lädt Ihr Browser
              die benötigten Web Fonts in ihren Browsercache, um Texte und
              Schriftarten korrekt anzuzeigen.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold">6. Ihre Rechte</h3>
          <div className="space-y-2">
            <p>
              Sie haben jederzeit das Recht unentgeltlich Auskunft über
              Herkunft, Empfänger und Zweck Ihrer gespeicherten
              personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht,
              die Berichtigung, Sperrung oder Löschung dieser Daten zu
              verlangen.
            </p>
            <p>
              Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie
              sich jederzeit unter der im Impressum angegebenen Adresse an uns
              wenden.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
