import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { AlertTriangle, Info, Shield } from "lucide-react";

const supportEmail = "support@mdscribe.de";

const withdrawalHref =
	"mailto:support@mdscribe.de?subject=Vertrag%20widerrufen&body=Hiermit%20widerrufe%20ich%20meinen%20MDScribe-Vertrag.%0A%0AName:%0AE-Mail-Adresse%20des%20MDScribe-Kontos:%0ABestelldatum%20(optional):";

export default function LegalPage() {
	return (
		<div className="h-full w-full space-y-8">
			<div className="rounded-lg border-2 border-solarized-red bg-solarized-base3 p-6 dark:border-solarized-orange">
				<div className="flex items-start space-x-3">
					<AlertTriangle className="h-6 w-6 flex-shrink-0 text-solarized-red dark:text-solarized-orange" />
					<div className="space-y-2">
						<h3 className="font-semibold text-lg text-solarized-red dark:text-solarized-orange">
							Wichtiger Hinweis
						</h3>
						<p className="text-sm text-solarized-base01">
							<strong className="text-solarized-red dark:text-solarized-orange">
								MDScribe stellt keine medizinische Beratung bereit.
							</strong>{" "}
							Die Cloud-Plattform dient ausschließlich der Vereinfachung und Beschleunigung
							medizinischer Dokumentation. Generierte Inhalte ersetzen weder die klinische
							Beurteilung noch Diagnose, Therapieentscheidung oder Behandlung durch qualifizierte
							medizinische Fachkräfte. Sämtliche Inhalte sind vor ihrer Verwendung fachlich zu
							prüfen.
						</p>
					</div>
				</div>
			</div>

			<section className="space-y-6">
				<h2 className="font-semibold text-xl">Impressum</h2>
				<div className="space-y-4">
					<h3 className="font-semibold">Angaben gemäß § 5 DDG</h3>
					<p>Dr. med. Nils Hapke</p>
				</div>

				<div className="space-y-4">
					<h3 className="font-semibold">Kontakt</h3>
					<p>
						E-Mail:{" "}
						<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
							{supportEmail}
						</a>
					</p>
				</div>

				<div className="space-y-4">
					<h3 className="font-semibold">Verbraucherstreitbeilegung</h3>
					<p>
						Wir sind weder verpflichtet noch bereit, an einem Streitbeilegungsverfahren vor einer
						Verbraucherschlichtungsstelle teilzunehmen.
					</p>
					<p>
						Die frühere Europäische Plattform für Online-Streitbeilegung (OS-Plattform) wurde zum
						20. Juli 2025 eingestellt. Informationen der Europäischen Kommission zur
						außergerichtlichen Verbraucherstreitbeilegung finden Sie unter{" "}
						<a
							className="underline underline-offset-4"
							href="https://consumer-redress.ec.europa.eu/index_de"
							rel="noopener noreferrer"
							target="_blank"
						>
							consumer-redress.ec.europa.eu
						</a>
						.
					</p>
				</div>
			</section>

			<Tabs className="w-full" defaultValue="datenschutz">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="datenschutz">Datenschutzerklärung</TabsTrigger>
					<TabsTrigger value="agb">Geschäftsbedingungen</TabsTrigger>
				</TabsList>

				<TabsContent className="space-y-8" value="datenschutz">
					<div className="space-y-8">
						<div className="space-y-4">
							<h2 className="font-semibold text-2xl">
								Datenschutzerklärung für die MDScribe Cloud
							</h2>
							<p className="text-muted-foreground text-sm">Stand: 27.07.2026</p>
							<p className="text-muted-foreground">
								Diese Datenschutzerklärung gilt ausschließlich für die von uns unter mdscribe.de
								betriebene Cloud-Version von MDScribe. Bei einer selbst gehosteten oder anderweitig
								vor Ort betriebenen Installation stellt MDScribe lediglich die Softwarelizenz
								bereit. Der jeweilige Betreiber entscheidet dort selbst über Bereitstellung und
								Datenverarbeitung und ist für seine Datenschutzhinweise sowie die Einhaltung des
								Datenschutzrechts verantwortlich.
							</p>
						</div>

						<div className="rounded-lg border border-solarized-yellow bg-solarized-base3 p-4 text-sm text-solarized-base01">
							<div className="flex items-start gap-3">
								<AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-solarized-yellow" />
								<div className="space-y-2">
									<p className="font-medium">Keine patientenidentifizierenden Gesundheitsdaten</p>
									<p>
										Die MDScribe Cloud ist derzeit nicht für die Verarbeitung
										patientenidentifizierender Gesundheitsdaten vorgesehen. Eingaben müssen vor der
										Übermittlung wirksam anonymisiert werden. Insbesondere dürfen keine Namen,
										Geburtsdaten, Kontaktdaten, Versicherungsnummern oder sonstigen Angaben
										eingegeben werden, durch die eine Person bestimmt oder bestimmbar wird.
									</p>
								</div>
							</div>
						</div>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">1. Verantwortlicher und Kontakt</h3>
							<div className="space-y-2">
								<p>Verantwortlicher für die MDScribe Cloud ist:</p>
								<p>Dr. med. Nils Hapke</p>
								<p>
									E-Mail:{" "}
									<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
										{supportEmail}
									</a>
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">
								2. Aufruf der Website, Geräte- und Sitzungsdaten
							</h3>
							<div className="space-y-3">
								<p>
									Beim Aufruf der Website und während der Nutzung können IP-Adresse, Datum und
									Uhrzeit, aufgerufene URL, Referrer, Browsertyp und -version, Betriebssystem,
									Geräteinformationen sowie Fehler- und Sicherheitsereignisse verarbeitet werden.
									Dies ist erforderlich, um die Plattform auszuliefern, technische Fehler zu
									untersuchen, Angriffe abzuwehren und die Stabilität zu gewährleisten.
								</p>
								<p>
									Für Anmeldung und Sitzungsverwaltung verwenden wir technisch notwendige Cookies
									beziehungsweise vergleichbare Speichertechniken. Sie enthalten insbesondere einen
									Sitzungsbezug und können eine kurzzeitig zwischengespeicherte Anmeldeinformation
									enthalten. Zusätzlich kann eine Oberflächeneinstellung, etwa der Zustand der
									Seitenleiste, gespeichert werden. Ohne diese Funktionen sind Anmeldung und
									grundlegende Bedienung nicht zuverlässig möglich.
								</p>
								<p>
									Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO, soweit die Verarbeitung zur
									Nutzung der Plattform erforderlich ist, und Art. 6 Abs. 1 lit. f DSGVO für
									Sicherheit, Fehleranalyse und Missbrauchsprävention. Der Zugriff auf technisch
									notwendige Endgeräteinformationen erfolgt nach § 25 Abs. 2 Nr. 2 TDDDG.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">3. Registrierung und Nutzerkonto</h3>
							<div className="space-y-3">
								<p>
									Bei Registrierung und Kontoverwaltung verarbeiten wir E-Mail-Adresse,
									Benutzername, Anzeigename, den Verifizierungsstatus, Konto- und
									Änderungszeitpunkte sowie, falls vom Nutzer hinterlegt, Name und Profilbild.
									Passwörter werden nicht im Klartext, sondern als kryptografischer Prüfwert
									gespeichert. Für Sicherheit und Sitzungsverwaltung können außerdem Sitzungstoken,
									Ablaufzeitpunkt, IP-Adresse und User-Agent verarbeitet werden.
								</p>
								<p>
									Die Datenschutzerklärung dient der Information und muss nicht als Einwilligung
									angenommen werden. Rechtsgrundlage für die Konto- und Vertragsverwaltung ist Art.
									6 Abs. 1 lit. b DSGVO; für Verifizierung und Kontosicherheit Art. 6 Abs. 1 lit. f
									DSGVO.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">4. Plattforminhalte und KI-Nutzung</h3>
							<div className="space-y-4">
								<div className="space-y-2">
									<h4 className="font-medium">
										4.1 Vorlagen, Dokumente und sonstige Nutzerinhalte
									</h4>
									<p>
										Wir verarbeiten die vom Nutzer erstellten Vorlagen, Anweisungen,
										Dokumentdefinitionen, Formularinhalte und weitere gespeicherte Inhalte, um die
										gewählten Funktionen bereitzustellen. Bei als öffentlich gekennzeichneten
										Inhalten werden Inhalt, Benutzername beziehungsweise Autorenangabe und
										zugehörige Interaktionen anderen Nutzern angezeigt. Private Inhalte sind nur im
										Rahmen der dafür vorgesehenen Kontofunktionen zugänglich.
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">4.2 KI-Eingaben, Ausgaben und Nutzungsprotokolle</h4>
									<p>
										Zur Durchführung einer KI-Anfrage werden Eingaben, Anhänge, ausgewählte Vorlagen
										und Konfigurationen an die jeweils eingesetzten KI-Dienste übermittelt. Die
										erzeugten Ausgaben werden an das Nutzerkonto zurückgegeben und nur dann
										dauerhaft als Plattforminhalt gespeichert, wenn die jeweilige Funktion dies
										vorsieht oder der Nutzer sie speichert.
									</p>
									<p>
										Für kostenlose Konten können Eingaben und Ausgaben zusammen mit Nutzungsdaten
										zur Fehleranalyse, Qualitätssicherung und Produktverbesserung intern
										protokolliert werden. Bei aktiven Plus-Abonnements werden in der regulären
										internen Nutzungsprotokollierung keine Eingabe- oder Ausgabeinhalte gespeichert.
										In beiden Tarifen werden kontobezogene Metadaten verarbeitet, insbesondere
										Zeitpunkt, Funktion, Modell, Token- und Kostenwerte, Status, Endpunkt und
										technische Konfiguration. Diese Metadaten sind wegen ihres Kontobezugs nicht
										anonym.
									</p>
									<p>
										Diese Aussage betrifft allein die interne Nutzungsprotokollierung von MDScribe.
										Für die Verarbeitung durch externe KI-Dienste gelten zusätzlich Abschnitt 6 und
										die Bedingungen des jeweils eingesetzten Dienstes. Eine pauschale Zusicherung,
										dass sämtliche Anbieter keinerlei Daten vorübergehend speichern, wird nicht
										erteilt.
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">
										4.3 Kontingente, Abrechnung und Missbrauchsprävention
									</h4>
									<p>
										Wir verarbeiten Anzahl und Art der Aufrufe, Token- und Ressourcenverbrauch,
										geschätzte beziehungsweise angefallene Kosten sowie den Abonnementstatus, um
										Nutzungskontingente durchzusetzen, Leistungen abzurechnen und missbräuchliche
										Nutzung zu erkennen.
									</p>
								</div>

								<p>
									Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Soweit Protokolle zur Sicherheit,
									Fehleranalyse oder Produktverbesserung erforderlich sind, ist Rechtsgrundlage Art.
									6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im sicheren,
									wirtschaftlichen und technisch zuverlässigen Betrieb der Plattform.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">5. E-Mail-Kommunikation</h3>
							<div className="space-y-3">
								<p>
									Wir verwenden die im Konto hinterlegte E-Mail-Adresse für Verifizierung,
									Anmeldung, Passwortzurücksetzung, Sicherheitsmeldungen, wesentliche
									Vertragsinformationen und sonstige zur Bereitstellung der Plattform erforderliche
									Nachrichten. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b und lit. f DSGVO.
								</p>
								<p>
									Die im Zusammenhang mit dem Erwerb unserer Dienstleistung erhaltene E-Mail-Adresse
									können wir nach § 7 Abs. 3 UWG für Informationen über eigene ähnliche Funktionen
									und Angebote verwenden. Rechtsgrundlage der hierfür erforderlichen
									Datenverarbeitung ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist
									die Information bestehender Nutzer über die Weiterentwicklung von MDScribe. Einer
									werblichen Verwendung der E-Mail-Adresse kann jederzeit kostenfrei und formlos
									über{" "}
									<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
										{supportEmail}
									</a>{" "}
									widersprochen werden. Auf diese Möglichkeit weisen wir bei Erhebung der
									E-Mail-Adresse und in jeder entsprechenden Nachricht hin. Vertrags- und
									Sicherheitsnachrichten bleiben davon unberührt.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">6. Empfänger und eingesetzte Dienstleister</h3>
							<div className="space-y-5">
								<p>
									Wir übermitteln personenbezogene Daten nur, soweit dies für die nachfolgend
									beschriebenen Zwecke erforderlich ist, gesetzlich verlangt wird oder eine wirksame
									Einwilligung vorliegt. Dienstleister erhalten nur die für ihre Aufgabe
									erforderlichen Daten.
								</p>

								<div className="space-y-2">
									<h4 className="font-medium">6.1 Hetzner Online GmbH – Hosting</h4>
									<p>
										Hetzner stellt die technische Infrastruktur für die MDScribe Cloud bereit. Dabei
										können sämtliche auf der Plattform verarbeiteten Daten, Serverprotokolle und
										Sicherungen auf der Hosting-Infrastruktur verarbeitet werden. Rechtsgrundlagen
										sind Art. 6 Abs. 1 lit. b und lit. f DSGVO.
									</p>
									<p>
										<a
											className="underline underline-offset-4"
											href="https://www.hetzner.com/de/legal/privacy-policy/"
											rel="noopener noreferrer"
											target="_blank"
										>
											Datenschutzhinweise von Hetzner
										</a>
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">6.2 Postmark – E-Mail-Versand</h4>
									<p>
										Für den Versand von Konto-, Sicherheits-, Vertrags- und gegebenenfalls
										zulässigen Produktnachrichten nutzen wir Postmark (AC PM LLC), einen Dienst der
										ActiveCampaign-Gruppe. Dabei werden insbesondere Empfängeradresse, Absender,
										Nachrichteninhalt, Versandzeitpunkt, Zustellstatus sowie technische Zustell- und
										Unterdrückungsdaten verarbeitet. Postmark verarbeitet Daten auch in den USA. Für
										erforderliche Drittlandübermittlungen werden die anwendbaren
										Übermittlungsmechanismen, insbesondere EU-Standardvertragsklauseln, verwendet.
									</p>
									<p>
										Nach den Angaben von Postmark werden Nachrichteninhalt und Metadaten regulär 45
										Tage vorgehalten. Informationen über Unzustellbarkeit, Spam-Beschwerden und
										abgemeldete Empfänger können in einer Unterdrückungsliste ohne feste Löschfrist
										gespeichert werden, damit entsprechende Nachrichten nicht erneut versandt
										werden.
									</p>
									<p>
										<a
											className="underline underline-offset-4"
											href="https://postmarkapp.com/eu-privacy"
											rel="noopener noreferrer"
											target="_blank"
										>
											Datenschutzinformationen von Postmark
										</a>
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">6.3 KI-Dienste</h4>
									<p>
										Zur Bereitstellung der KI-Funktionen werden die für eine Anfrage erforderlichen
										Eingaben, Anhänge, Vorlageninformationen und technischen Parameter an
										administrativ konfigurierte Anbieter übertragen. Dazu können OpenRouter und die
										darüber ausgewählten Modellanbieter, direkt konfigurierte OpenAI-kompatible
										Anbieter sowie Tinfoil gehören. Die tatsächlich verwendeten Anbieter hängen von
										Funktion, Modellauswahl und aktueller Konfiguration ab.
									</p>
									<div className="rounded-lg border border-solarized-yellow bg-solarized-base2 p-3">
										<p className="text-sm">
											<strong>Keine patientenidentifizierenden Daten übermitteln:</strong> Inhalte
											können außerhalb der Europäischen Union verarbeitet werden. Nutzen Sie die
											Cloud-KI-Funktionen ausschließlich mit wirksam anonymisierten Inhalten.
										</p>
									</div>
									<p>
										Bei Übermittlungen in Drittländer stützen wir uns, soweit erforderlich, auf
										einen Angemessenheitsbeschluss oder geeignete Garantien wie
										EU-Standardvertragsklauseln. Rechtsgrundlage für die zur Leistungserbringung
										erforderliche Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO.
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>
											<a
												className="underline underline-offset-4"
												href="https://openrouter.ai/privacy"
												rel="noopener noreferrer"
												target="_blank"
											>
												Datenschutzhinweise von OpenRouter
											</a>
										</li>
									</ul>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">6.4 Stripe – Abonnement und Zahlung</h4>
									<p>
										Für Checkout, wiederkehrende Zahlungen, Rechnungs- und Abonnementverwaltung
										nutzen wir Stripe. Dabei verarbeiten wir eine Stripe-Kundenkennung sowie
										Abonnementstatus, Tarif, Laufzeit- und Zahlungsstatus. Zahlungsdaten werden im
										Stripe-Checkout unmittelbar von Stripe erhoben und nicht auf unseren Servern
										gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO; gesetzlich
										erforderliche Abrechnungsdaten verarbeiten wir nach Art. 6 Abs. 1 lit. c DSGVO.
									</p>
									<p>
										<a
											className="underline underline-offset-4"
											href="https://stripe.com/de/privacy"
											rel="noopener noreferrer"
											target="_blank"
										>
											Datenschutzhinweise von Stripe
										</a>
									</p>
								</div>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">7. Speicherdauer und Löschung</h3>
							<div className="space-y-3">
								<p>
									Wir speichern personenbezogene Daten nicht länger, als es für den jeweiligen Zweck
									erforderlich ist. Dabei gelten insbesondere folgende Kriterien:
								</p>
								<ul className="list-disc space-y-2 pl-6">
									<li>
										Konto- und Profildaten werden grundsätzlich für die Dauer des Nutzerkontos
										gespeichert.
									</li>
									<li>
										Sitzungs-, Verifizierungs- und Passwortzurücksetzungsdaten werden nach Ablauf
										oder Zweckerreichung gelöscht, soweit sie nicht vorübergehend zur Sicherheits-
										und Missbrauchsaufklärung benötigt werden.
									</li>
									<li>
										Private Inhalte werden bis zur Löschung durch den Nutzer oder bis zur
										Kontolöschung gespeichert. Öffentliche Inhalte können bis zu ihrer Löschung oder
										Sperrung veröffentlicht bleiben.
									</li>
									<li>
										Nutzungs- und Sicherheitsprotokolle werden gelöscht oder ihres Personenbezugs
										entledigt, sobald sie für Kontingentverwaltung, Abrechnung, Fehleranalyse und
										Sicherheit nicht mehr erforderlich sind.
									</li>
									<li>
										Vertrags-, Abrechnungs- und Zahlungsnachweise bleiben erhalten, solange
										gesetzliche handels- oder steuerrechtliche Aufbewahrungspflichten oder die
										Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen dies erfordern.
									</li>
									<li>
										In Sicherungen enthaltene Daten werden mit dem regulären Austausch der
										Sicherungen überschrieben, sofern keine gesetzliche Pflicht zur längeren
										Aufbewahrung besteht.
									</li>
								</ul>
								<p>
									Ein Löschverlangen kann über{" "}
									<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
										{supportEmail}
									</a>{" "}
									gestellt werden. Vor einer Löschung können wir einen Nachweis verlangen, der
									erforderlich ist, um die anfragende Person sicher zu identifizieren.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">
								8. Gesetzliche Empfänger und Rechtsdurchsetzung
							</h3>
							<p>
								Daten können außerdem an Gerichte, Behörden, Rechtsberater oder sonstige berechtigte
								Stellen übermittelt werden, wenn wir dazu gesetzlich verpflichtet sind oder dies zur
								Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen sowie zur Aufklärung
								rechtswidriger Nutzung erforderlich ist. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. c
								und lit. f DSGVO.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">9. Ihre Rechte</h3>
							<div className="space-y-3">
								<p>
									Soweit die gesetzlichen Voraussetzungen vorliegen, haben Sie das Recht auf
									Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
									Datenübertragbarkeit. Sie können einer Verarbeitung auf Grundlage berechtigter
									Interessen aus Gründen Ihrer besonderen Situation widersprechen. Eine Einwilligung
									kann jederzeit mit Wirkung für die Zukunft widerrufen werden.
								</p>
								<p>
									Zur Ausübung Ihrer Rechte genügt eine Nachricht an{" "}
									<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
										{supportEmail}
									</a>
									. Außerdem können Sie sich bei einer Datenschutzaufsichtsbehörde beschweren,
									insbesondere an Ihrem gewöhnlichen Aufenthaltsort, Arbeitsplatz oder am Ort des
									vermuteten Verstoßes.
								</p>
								<p>
									Eine ausschließlich automatisierte Entscheidung, die Ihnen gegenüber rechtliche
									Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt, findet
									nicht statt.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">10. Datensicherheit</h3>
							<p>
								Wir treffen angemessene technische und organisatorische Maßnahmen zum Schutz
								personenbezogener Daten. Die Übertragung zwischen Browser und Plattform erfolgt
								verschlüsselt. Ein absoluter Schutz vor sämtlichen Risiken kann jedoch nicht
								garantiert werden.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">11. Änderungen dieser Datenschutzerklärung</h3>
							<p>
								Wir aktualisieren diese Datenschutzerklärung, wenn sich Verarbeitungen,
								Dienstleister oder rechtliche Anforderungen ändern. Die jeweils aktuelle Fassung ist
								auf mdscribe.de abrufbar. Über wesentliche Änderungen informieren wir registrierte
								Nutzer in angemessener Form.
							</p>
						</section>
					</div>
				</TabsContent>

				<TabsContent className="space-y-8" value="agb">
					<div className="space-y-8">
						<div className="space-y-4">
							<h2 className="font-semibold text-2xl">
								Allgemeine Geschäftsbedingungen für die MDScribe Cloud
							</h2>
							<p className="text-muted-foreground text-sm">Stand: 27.07.2026</p>
						</div>

						<section className="space-y-3">
							<h3 className="font-semibold text-xl">1. Geltungsbereich</h3>
							<p>
								Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der von Dr. med. Nils
								Hapke unter mdscribe.de betriebenen Cloud-Version von MDScribe (&quot;MDScribe
								Cloud&quot;). Das Angebot richtet sich insbesondere an Assistenzärztinnen und
								Assistenzärzte sowie andere medizinische Fachkräfte.
							</p>
							<p>
								Diese AGB gelten nicht für selbst gehostete oder vor Ort betriebene Installationen.
								Für solche Installationen wird lediglich eine gesonderte Softwarelizenz verkauft;
								Bereitstellung, Betrieb und Datenschutz liegen in der Verantwortung des jeweiligen
								Betreibers.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">2. Gegenstand und Grenzen der Plattform</h3>
							<div className="rounded-lg border border-solarized-blue bg-solarized-base2 p-4 dark:border-solarized-cyan">
								<div className="flex items-start space-x-3">
									<Info className="h-5 w-5 flex-shrink-0 text-solarized-blue dark:text-solarized-cyan" />
									<p className="text-sm">
										MDScribe ist eine Dokumentationshilfe. Die Plattform unterstützt unter anderem
										bei Vorlagen, Textbausteinen, Formularen und KI-gestützter Texterstellung. Sie
										erbringt keine medizinische Beratung und keine eigenständige Diagnose- oder
										Therapieentscheidung.
									</p>
								</div>
							</div>
							<p>
								KI-Ausgaben können unvollständig, unzutreffend oder für den Einzelfall ungeeignet
								sein. Der Nutzer muss jede Ausgabe vor ihrer Verwendung fachlich prüfen und bleibt
								für Dokumentation und medizinische Entscheidungen verantwortlich. Die MDScribe Cloud
								ist nicht für patientenidentifizierende Gesundheitsdaten vorgesehen.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">3. Konten, Tarife und Leistungsumfang</h3>
							<div className="space-y-2">
								<h4 className="font-medium">3.1 Kostenloser Tarif</h4>
								<p>
									Der kostenlose Tarif ermöglicht die Nutzung ausgewählter öffentlicher Inhalte
									sowie, nach Registrierung, der jeweils ausgewiesenen kostenlosen Konto- und
									KI-Funktionen. Umfang und Nutzungslimits ergeben sich aus der aktuellen
									Leistungsbeschreibung auf der Homepage.
								</p>
							</div>
							<div className="space-y-2">
								<h4 className="font-medium">3.2 Plus-Tarif</h4>
								<p>
									Plus ist ein kostenpflichtiges Abonnement mit erweitertem Nutzungsbudget und
									zusätzlichen Funktionen, insbesondere für private Inhalte. Plus kann mit
									monatlicher oder jährlicher Abrechnung angeboten werden. Nicht verbrauchtes
									Nutzungsbudget wird nicht in einen folgenden Abrechnungszeitraum übertragen.
								</p>
							</div>
							<div className="space-y-2">
								<h4 className="font-medium">3.3 Preise und konkrete Leistungsbeschreibung</h4>
								<p>
									Die jeweils gültigen Preise, Abrechnungsintervalle, Nutzungslimits und enthaltenen
									Funktionen werden auf der Homepage und vor Abschluss im Checkout angezeigt. Die
									Checkout-Angaben gehen bei Abweichungen einer allgemeinen Beschreibung auf dieser
									Seite vor. Preisänderungen gelten nicht rückwirkend für bereits bezahlte
									Abrechnungszeiträume.
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">
								4. Vertragsschluss, Leistungsbeginn und Zahlung
							</h3>
							<p>
								Ein kostenloses Nutzungsverhältnis kommt mit erfolgreicher Registrierung zustande.
								Der Plus-Vertrag kommt zustande, wenn der Nutzer im Stripe-Checkout die
								zahlungspflichtige Bestellung abgibt und der Abschluss bestätigt wird.
							</p>
							<p>
								Die Plus-Funktionen werden grundsätzlich unmittelbar nach erfolgreichem Checkout
								aktiviert. Der Preis für den gewählten monatlichen oder jährlichen
								Abrechnungszeitraum ist jeweils zu Beginn dieses Zeitraums im Voraus fällig. Stripe
								zieht den Betrag über die im Checkout gewählte Zahlungsmethode ein und stellt die
								dort vorgesehenen Zahlungs- und Rechnungsinformationen bereit.
							</p>
							<p>
								Schlägt eine fällige Zahlung fehl, können die Plus-Funktionen bis zur erfolgreichen
								Zahlung eingeschränkt werden. Gesetzliche Rechte wegen Zahlungsverzugs bleiben
								unberührt.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">5. Laufzeit und Kündigung</h3>
							<p>
								Plus läuft für den im Checkout gewählten monatlichen oder jährlichen
								Abrechnungszeitraum und verlängert sich jeweils um einen weiteren gleich langen
								Zeitraum, wenn es nicht vor der nächsten Verlängerung gekündigt wird.
							</p>
							<p>
								Das Abonnement kann jederzeit über &quot;Abonnement&quot; beziehungsweise die dort
								verknüpfte Stripe-Abonnementverwaltung gekündigt werden. Die Kündigung wird zum Ende
								des bereits bezahlten Abrechnungszeitraums wirksam; bis dahin bleiben die
								Plus-Funktionen nutzbar. Eine anteilige Erstattung für den laufenden Zeitraum
								erfolgt nicht, soweit kein gesetzlicher Erstattungsanspruch besteht.
							</p>
							<p>
								Die Kündigung von Plus löscht das Nutzerkonto nicht. Die Löschung eines kostenlosen
								oder nach Kündigung verbleibenden Kontos kann über{" "}
								<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
									{supportEmail}
								</a>{" "}
								verlangt werden.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">6. Widerrufsrecht für Verbraucher</h3>
							<p>
								Verbraucher haben bei einem im Fernabsatz geschlossenen kostenpflichtigen Vertrag
								grundsätzlich ein gesetzliches Widerrufsrecht von vierzehn Tagen ab Vertragsschluss.
								Zur Ausübung genügt eine eindeutige Erklärung, aus der der Entschluss zum Widerruf
								hervorgeht. Die Angabe eines Grundes ist nicht erforderlich.
							</p>
							<p>
								Der Widerruf kann per E-Mail an{" "}
								<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
									{supportEmail}
								</a>{" "}
								gesendet werden. Verwenden Sie dafür auf Wunsch den folgenden vorbereiteten Link:
							</p>
							<p>
								<a
									className="inline-flex rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
									href={withdrawalHref}
								>
									Vertrag widerrufen
								</a>
							</p>
							<p>
								Zur Zuordnung genügen Name und E-Mail-Adresse des MDScribe-Kontos. Nach wirksamem
								Widerruf werden empfangene Zahlungen nach Maßgabe der gesetzlichen Vorschriften
								zurückgewährt. Gesetzliche Regelungen zum Wertersatz für bis zum Widerruf bereits
								erbrachte Leistungen bleiben unberührt.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">7. Pflichten der Nutzer</h3>
							<ul className="list-disc space-y-2 pl-6">
								<li>
									Kontodaten sind richtig und aktuell zu halten; Zugangsdaten dürfen nicht an
									unberechtigte Dritte weitergegeben werden.
								</li>
								<li>
									Es dürfen keine patientenidentifizierenden oder sonstigen unzulässigen
									personenbezogenen Daten in die MDScribe Cloud eingegeben werden.
								</li>
								<li>
									Die Plattform darf nicht missbräuchlich, rechtswidrig oder zur Beeinträchtigung
									ihrer Sicherheit und Verfügbarkeit genutzt werden.
								</li>
								<li>
									Automatisierte Zugriffe und eine Umgehung von Nutzungslimits sind ohne vorherige
									Erlaubnis unzulässig.
								</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">8. Nutzerinhalte und Moderation</h3>
							<p>
								Nutzer sind für sämtliche Inhalte verantwortlich, die sie erstellen, hochladen,
								speichern oder veröffentlichen. Sie müssen über alle dafür erforderlichen Rechte
								verfügen und sicherstellen, dass die Inhalte deutsches Recht und Rechte Dritter
								einhalten. Unzulässig sind insbesondere rechtswidrige, beleidigende,
								diskriminierende, bedrohende, urheberrechtsverletzende oder datenschutzwidrige
								Inhalte.
							</p>
							<p>
								Der Nutzer behält seine Rechte an seinen Inhalten. Er räumt uns die für Betrieb,
								Speicherung, Verarbeitung, Sicherung und Anzeige innerhalb der Plattform
								erforderlichen, einfachen und auf die Nutzungsdauer beschränkten Rechte ein. Für vom
								Nutzer als öffentlich gekennzeichnete Inhalte umfasst dies die öffentliche Anzeige
								und die von der Plattform vorgesehene Nutzung durch andere Nutzer.
							</p>
							<p>
								Wir dürfen rechtswidrige oder vertragswidrige Inhalte sperren oder entfernen und
								Konten vorübergehend sperren oder bei schweren beziehungsweise wiederholten
								Verstößen kündigen. Maßnahmen richten sich nach Art, Schwere, Häufigkeit und
								Auswirkung des Verstoßes. Bei eindeutig rechtswidrigen Inhalten, akuten
								Sicherheitsrisiken oder Gefahr im Verzug kann eine Maßnahme sofort erfolgen. Soweit
								rechtlich zulässig und zumutbar, informieren wir den betroffenen Nutzer über Grund
								und Umfang der Maßnahme.
							</p>
							<p>
								Hinweise auf rechtswidrige Inhalte und Einwände gegen Moderationsmaßnahmen können an{" "}
								<a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
									{supportEmail}
								</a>{" "}
								gesendet werden.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">9. Verfügbarkeit und Leistungsänderungen</h3>
							<p>
								Wir schulden keine ununterbrochene Verfügbarkeit. Vorübergehende Einschränkungen
								können insbesondere durch Wartung, Sicherheitsmaßnahmen, Störungen bei
								Dienstleistern oder Ereignisse außerhalb unseres Einflussbereichs entstehen.
							</p>
							<p>
								Wir dürfen Funktionen aus sachlichem Grund ändern, etwa wegen Sicherheit,
								technischer Weiterentwicklung, geänderter Dienstleister, Missbrauchsschutz oder
								rechtlicher Anforderungen, sofern das vertragliche Gleichgewicht nicht grundlos
								zulasten des Nutzers verschoben wird. Über Änderungen, die Zugriff oder Nutzbarkeit
								mehr als nur unerheblich beeinträchtigen, informieren wir innerhalb angemessener
								Frist. Gesetzliche Rechte bei Änderungen digitaler Produkte bleiben unberührt.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">10. Gewerbliche Schutzrechte</h3>
							<p>
								Software, Gestaltung, Marken und vom Anbieter bereitgestellte Inhalte sind rechtlich
								geschützt. Nutzer erhalten für die Vertragsdauer ein einfaches, nicht übertragbares
								Recht, die Plattform bestimmungsgemäß zu verwenden. Rechte an Nutzerinhalten richten
								sich nach Abschnitt 8.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">11. Haftung</h3>
							<div className="rounded-lg border border-solarized-red bg-solarized-base2 p-4 dark:border-solarized-orange">
								<div className="flex items-start space-x-3">
									<Shield className="h-5 w-5 flex-shrink-0 text-solarized-red dark:text-solarized-orange" />
									<p className="text-sm">
										Generierte Inhalte sind fachlich zu prüfen. MDScribe übernimmt keine
										medizinische Entscheidung und ersetzt weder ärztliche Sorgfalt noch die
										Dokumentationspflicht des Nutzers.
									</p>
								</div>
							</div>
							<p>
								Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei schuldhafter
								Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz sowie
								in sonstigen gesetzlich zwingenden Fällen. Bei leicht fahrlässiger Verletzung einer
								wesentlichen Vertragspflicht ist die Haftung auf den bei Vertragsschluss
								vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist die Haftung für
								leichte Fahrlässigkeit ausgeschlossen.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">12. Datenschutz</h3>
							<p>
								Informationen zur Verarbeitung personenbezogener Daten in der MDScribe Cloud enthält
								die Datenschutzerklärung auf dieser Seite. Die Datenschutzerklärung ist eine
								Information und wird nicht durch bloße Nutzung der Plattform als Einwilligung
								angenommen.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">13. Änderungen dieser AGB</h3>
							<p>
								Wir können diese AGB ändern, wenn ein sachlicher Grund besteht, etwa eine Änderung
								der Rechtslage oder eine erforderliche Anpassung an die technische
								Weiterentwicklung, und die Änderung für Nutzer zumutbar ist. Über wesentliche
								Änderungen informieren wir vor ihrem Inkrafttreten. Soweit eine Änderung die
								Zustimmung des Nutzers erfordert, wird sie erst nach ausdrücklicher Zustimmung
								Vertragsbestandteil. Schweigen gilt nicht allein deshalb als Zustimmung, weil eine
								Mitteilung versandt wurde.
							</p>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">14. Schlussbestimmungen</h3>
							<p>
								Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gegenüber Verbrauchern
								gilt diese Rechtswahl nur, soweit ihnen dadurch der Schutz zwingender Bestimmungen
								des Staates ihres gewöhnlichen Aufenthalts nicht entzogen wird. Ein Gerichtsstand
								wird nur vereinbart, soweit dies gesetzlich zulässig ist.
							</p>
							<p>
								Sollte eine Bestimmung ganz oder teilweise unwirksam sein, bleibt die Wirksamkeit
								der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung treten
								die gesetzlichen Vorschriften.
							</p>
						</section>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
