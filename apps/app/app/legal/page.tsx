"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { AlertTriangle, Info, Shield } from "lucide-react";

export default function LegalPage() {
	return (
		<div className="h-full w-full space-y-8">
			{/* Prominent Medical Disclaimer */}
			<div className="rounded-lg border-2 border-solarized-red bg-solarized-base3 p-6 dark:border-solarized-orange dark:bg-solarized-base02">
				<div className="flex items-start space-x-3">
					<div className="flex-shrink-0">
						<AlertTriangle className="h-6 w-6 text-solarized-red dark:text-solarized-orange" />
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-lg text-solarized-red dark:text-solarized-orange">
							Wichtiger Hinweis
						</h3>
						<p className="text-sm text-solarized-base01 dark:text-solarized-base1">
							<strong className="text-solarized-red dark:text-solarized-orange">
								mdscribe.de stellt KEINE medizinische Beratung dar.
							</strong>{" "}
							Diese Plattform dient ausschließlich der Vereinfachung und
							Beschleunigung der medizinischen Dokumentation. Die generierten
							Texte und Vorlagen ersetzen nicht die klinische Beurteilung,
							Diagnose oder Behandlung durch qualifizierte Ärzte. Alle
							medizinischen Entscheidungen müssen weiterhin auf Basis der
							individuellen klinischen Beurteilung und aktueller medizinischer
							Standards getroffen werden.
						</p>
					</div>
				</div>
			</div>

			{/* Impressum section always visible at the top */}
			<section className="space-y-6">
				<h2 className="font-semibold text-xl">Impressum</h2>
				<div className="space-y-4">
					<h3 className="font-semibold">Angaben gemäß § 5 TMG</h3>
					<div className="space-y-2">
						<p>Dr. med. Nils Hapke</p>
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="font-semibold">Kontakt</h3>
					<div className="space-y-2">
						<p>E-Mail: support@mdscribe.de</p>
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="font-semibold">Streitschlichtung</h3>
					<p>
						Die Europäische Kommission stellt eine Plattform zur
						Online-Streitbeilegung (OS) bereit:
						https://ec.europa.eu/consumers/odr/
					</p>
					<p className="mt-4 w-full text-center text-muted-foreground text-xs">
						Die Informationen auf dieser Website dienen ausschließlich zu
						Bildungszwecken und Vereinfachung der Dokumentation, stellen jedoch
						keine medizinische Beratung dar. Sie ersetzen nicht die Konsultation
						eines Arztes / einer Ärztin.
					</p>
				</div>
			</section>

			{/* Tabs for Datenschutz and AGB */}
			<Tabs className="w-full" defaultValue="datenschutz">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="datenschutz">Datenschutzerklärung</TabsTrigger>
					<TabsTrigger value="agb">Geschäftsbedingungen</TabsTrigger>
				</TabsList>

				<TabsContent className="space-y-8" value="datenschutz">
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

						<div className="rounded-lg border border-solarized-base1 bg-solarized-base3 p-4 text-sm text-solarized-base01 dark:border-solarized-base01 dark:bg-solarized-base02 dark:text-solarized-base1">
							<div className="flex items-start gap-3">
								<Info className="mt-0.5 h-5 w-5 text-solarized-blue" />
								<div className="space-y-2">
									<p className="font-medium text-solarized-base01 dark:text-solarized-base1">
										Hinweis zu sensiblen Gesundheitsdaten (OSS)
									</p>
									<ul className="list-disc space-y-1 pl-5">
										<li>
											Die cloud-gehostete Nutzung sollte derzeit nicht als sicher
											für sensible Patienten-PII/PHI betrachtet werden, bis
											weitere Compliance-Kontrollen abgeschlossen sind.
										</li>
										<li>
											Self-Hosting ist der empfohlene Weg, wenn Sie volle Kontrolle
											darüber benötigen, wo Daten verarbeitet und gespeichert
											werden.
										</li>
									</ul>
									<p>
										Diese Hinweise sind risikobasiert und sollen helfen, ein
										geeignetes Bereitstellungsmodell für Ihre Anforderungen zu
										wählen.
									</p>
								</div>
							</div>
						</div>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">1. Verantwortlicher</h3>
							<div className="space-y-2">
								<p>
									Verantwortlich für die Datenverarbeitung auf dieser Website
									ist:
								</p>
								<p>Dr. med. Nils Hapke</p>
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
								4. Nutzungsverfolgung und Kontingentüberwachung
							</h3>
							<div className="space-y-4">
								<p>
									Zur Sicherstellung der Funktionalität, zur Optimierung der
									Services und zur Überwachung von Nutzungskontingenten wird die
									Nutzung der Plattform umfassend protokolliert.
								</p>

								<div className="space-y-2">
									<h4 className="font-medium">
										4.1 Interne Nutzungsdatenerfassung
									</h4>
									<p>Die erfassten Daten umfassen:</p>
									<ul className="list-disc space-y-2 pl-6">
										<li>Nutzungszeitpunkt und -dauer</li>
										<li>Art und Anzahl der genutzten KI-Funktionen</li>
										<li>Verbrauchte Kontingente (Tokens, Generierungen)</li>
										<li>Anonyme Session-Kennung</li>
										<li>Fehlermeldungen und Systemereignisse</li>
									</ul>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">4.2 Kontingentüberwachung</h4>
									<p>
										Für Nutzer mit kostenpflichtigen Abonnements werden
										Nutzungskontingente in Echtzeit überwacht, um
										sicherzustellen, dass die vereinbarten Limits eingehalten
										werden. Dies umfasst:
									</p>
									<ul className="list-disc space-y-2 pl-6">
										<li>Anzahl der KI-Generierungen pro Zeitraum</li>
										<li>Verbrauchte Tokens und Rechenressourcen</li>
										<li>Überschreitung von Tageslimits</li>
									</ul>
									<p>
										Diese Daten werden ausschließlich zur Bereitstellung der
										vereinbarten Serviceleistungen und zur Abrechnung verwendet.
									</p>
								</div>

								<p>
									Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
									(Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
									Interesse)
								</p>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">
								5. Externe Dienste und Datenverarbeitung
							</h3>
							<div className="space-y-4">
								<div className="space-y-2">
									<h4 className="font-medium">5.1 PostHog Analytics</h4>
									<p>
										Wir verwenden PostHog für die umfassende Analyse der
										Website-Nutzung und Benutzerinteraktionen. PostHog erfasst
										folgende Daten ohne das Setzen von Cookies:
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>
											Anonymisierte Benutzer-Events (Klicks, Seitenaufrufe)
										</li>
										<li>Feature-Nutzung und Navigationsverhalten</li>
										<li>Session-Dauer und Bounce-Rate</li>
										<li>Technische Browser- und Geräteinformationen</li>
									</ul>
									<p>
										Diese Daten helfen uns, die Benutzererfahrung zu optimieren
										und beliebte Funktionen zu identifizieren.
									</p>
									<p>
										Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
										Interesse)
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">5.2 Vercel Analytics</h4>
									<p>
										Zur Überwachung der Website-Performance und -Verfügbarkeit
										nutzen wir Vercel Analytics. Dabei werden anonymisierte
										Leistungsdaten erfasst, die keine Rückschlüsse auf einzelne
										Nutzer zulassen.
									</p>
									<p>
										Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
										Interesse)
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">
										5.3 Langfuse (KI-Monitoring und -Optimierung)
									</h4>
									<p>
										Für die Überwachung, Analyse und Verbesserung unserer
										KI-basierten Funktionen verwenden wir Langfuse. Dieses
										System erfasst detaillierte Informationen über die
										KI-Nutzung:
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>KI-Anfragen und -Antworten</li>
										<li>Verarbeitungszeiten und Performance-Metriken</li>
										<li>Fehleranalyse und Qualitätsbewertungen</li>
										<li>Token-Verbrauch und Kosten-Tracking</li>
										<li>Modell-Performance und Genauigkeitsmessungen</li>
									</ul>
									<p>
										Diese Daten werden ausschließlich zur technischen
										Optimierung der KI-Funktionen und zur Sicherstellung der
										Servicequalität verwendet. Eingabedaten werden anonymisiert
										und können nicht zu einzelnen Nutzern zurückverfolgt werden.
									</p>
									<p>
										Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
										Interesse), Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">
										5.4 Externe KI-Anbieter (Large Language Model Services)
									</h4>
									<p>
										Für die Bereitstellung der KI-basierten Funktionen nutzen
										wir externe Anbieter von Large Language Model (LLM)
										Services. Diese verarbeiten die anonymisierten Eingabedaten
										zur Generierung von Dokumentationsinhalten.
									</p>
									<div className="rounded-lg border border-solarized-yellow bg-solarized-base2 p-3 dark:border-solarized-yellow dark:bg-solarized-base01">
										<div className="flex items-start space-x-2">
											<div className="flex-shrink-0">
												<AlertTriangle className="h-4 w-4 text-solarized-yellow" />
											</div>
											<div>
												<p className="font-medium text-sm text-solarized-yellow">
													Wichtiger Hinweis zu externen KI-Anbietern:
												</p>
												<p className="text-solarized-base01 text-xs dark:text-solarized-base1">
													Eingabedaten werden anonymisiert an externe
													KI-Anbieter übertragen. Geben Sie niemals
													personenbezogene Gesundheitsdaten oder
													patientenidentifizierbare Informationen ein.
												</p>
											</div>
										</div>
									</div>
									<p>
										<strong>
											Verwendete externe Anbieter können umfassen:
										</strong>
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>OpenAI (GPT-Modelle)</li>
										<li>Anthropic (Claude-Modelle)</li>
										<li>
											Weitere LLM-Anbieter je nach Verfügbarkeit und Qualität
										</li>
									</ul>
									<p>
										Diese Anbieter verarbeiten die Daten gemäß ihren jeweiligen
										Datenschutzrichtlinien. Die Datenübertragung erfolgt
										verschlüsselt und ausschließlich für die Textgenerierung.
									</p>
									<p>
										Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
										(Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO
										(berechtigtes Interesse)
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">
										5.5 Stripe (Zahlungsabwicklung)
									</h4>
									<p>
										Für die Abwicklung von Zahlungen bei kostenpflichtigen
										Abonnements nutzen wir Stripe. Stripe verarbeitet
										Zahlungsdaten gemäß den geltenden PCI-DSS-Standards.
										Kreditkartendaten werden nicht auf unseren Servern
										gespeichert, sondern direkt bei Stripe verarbeitet.
									</p>
									<p>
										Weitere Informationen finden Sie in der Datenschutzerklärung
										von Stripe: https://stripe.com/privacy
									</p>
									<p>
										Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
										(Vertragserfüllung)
									</p>
								</div>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="font-semibold text-xl">
								6. Eingaben auf der Plattform
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
							<h3 className="font-semibold text-xl">7. Speicherdauer</h3>
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
							<h3 className="font-semibold text-xl">8. Weitergabe von Daten</h3>
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
							<h3 className="font-semibold text-xl">9. Ihre Rechte</h3>
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
							<h3 className="font-semibold text-xl">10. Datensicherheit</h3>
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
								11. Änderungen dieser Datenschutzerklärung
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

				<TabsContent className="space-y-8" value="agb">
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
										Nutzung der Website mdscribe.de (im Folgenden "Plattform"),
										betrieben von Dr. med. Nils Hapke. Sie regeln das Verhältnis
										zwischen dem Anbieter und den registrierten sowie nicht
										registrierten Nutzern der Plattform.
									</p>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">
										2. Art und Zweck der Plattform
									</h4>
									<div className="rounded-lg border border-solarized-blue bg-solarized-base2 p-4 dark:border-solarized-cyan dark:bg-solarized-base01">
										<div className="flex items-start space-x-3">
											<div className="flex-shrink-0">
												<Info className="h-5 w-5 text-solarized-blue dark:text-solarized-cyan" />
											</div>
											<div>
												<p className="font-semibold text-solarized-blue dark:text-solarized-cyan">
													Was ist mdscribe.de?
												</p>
												<p className="text-sm text-solarized-base01 dark:text-solarized-base1">
													mdscribe.de ist eine reine{" "}
													<strong className="text-solarized-blue dark:text-solarized-cyan">
														Dokumentationshilfe
													</strong>{" "}
													für medizinische Fachkräfte. Die Plattform nutzt
													KI-Technologie ausschließlich zur Vereinfachung und
													Beschleunigung der Texterstellung für administrative
													und dokumentarische Zwecke.
												</p>
											</div>
										</div>
									</div>
									<p>
										<strong>Was die Plattform bietet:</strong>
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>
											Textbausteine und Vorlagen für medizinische Dokumentation
										</li>
										<li>
											KI-unterstützte Generierung von Dokumentationstexten durch
											externe LLM-Anbieter
										</li>
										<li>Verwaltung und Organisation eigener Textvorlagen</li>
										<li>Zeitsparende Workflows für Routinedokumentation</li>
									</ul>
									<div className="rounded-lg border border-solarized-yellow bg-solarized-base2 p-3 dark:border-solarized-yellow dark:bg-solarized-base01">
										<div className="flex items-start space-x-2">
											<div className="flex-shrink-0">
												<Info className="h-4 w-4 text-solarized-yellow" />
											</div>
											<div>
												<p className="font-medium text-sm text-solarized-yellow">
													Externe KI-Dienste:
												</p>
												<p className="text-solarized-base01 text-xs dark:text-solarized-base1">
													Die KI-Funktionen werden durch externe Anbieter (z.B.
													OpenAI, Anthropic) bereitgestellt. Eingabedaten werden
													anonymisiert übertragen und gemäß den
													Datenschutzrichtlinien der jeweiligen Anbieter
													verarbeitet.
												</p>
											</div>
										</div>
									</div>
									<p>
										<strong>Was die Plattform NICHT bietet:</strong>
									</p>
									<ul className="list-disc space-y-1 pl-6">
										<li>Medizinische Beratung oder Diagnosestellung</li>
										<li>Behandlungsempfehlungen oder Therapievorschläge</li>
										<li>
											Ersatz für medizinische Fachliteratur oder Leitlinien
										</li>
										<li>Validierte medizinische Entscheidungsunterstützung</li>
									</ul>
								</div>

								<div className="space-y-2">
									<h4 className="font-medium">3. Leistungen von mdscribe.de</h4>
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
										2.3 Kostenpflichtige Abonnements und Kontingente
									</p>
									<p>
										Registrierte Nutzer können kostenpflichtige Abonnements mit
										verschiedenen Kontingenten abschließen. Diese ermöglichen
										den Zugang zu erweiterten KI-basierten Funktionen zur
										Erstellung medizinischer Dokumentation.
									</p>
									<div className="space-y-2">
										<p className="font-medium text-sm">Abonnement-Modelle:</p>
										<ul className="list-disc space-y-1 pl-6">
											<li>
												<strong>Basis-Kontingent:</strong> Begrenzte Anzahl an
												KI-Generierungen pro Monat
											</li>
											<li>
												<strong>Premium-Kontingent:</strong> Erhöhte Anzahl an
												KI-Generierungen und erweiterte Funktionen
											</li>
											<li>
												<strong>Unbegrenztes Kontingent:</strong> Unlimitierte
												Nutzung aller KI-Funktionen
											</li>
										</ul>
										<p className="text-sm">
											<strong>Kontingent-Bereitstellung:</strong> Nach
											erfolgreicher Zahlung werden die gebuchten Kontingente
											automatisch dem Nutzerkonto gutgeschrieben und sind sofort
											verfügbar. Nicht verbrauchte Kontingente verfallen am Ende
											des Abrechnungszeitraums und werden nicht übertragen.
										</p>
										<p className="text-sm">
											<strong>Nutzungsüberwachung:</strong> Der Verbrauch wird
											in Echtzeit überwacht. Bei Erreichen des Limits werden
											weitere Anfragen gesperrt, bis das Kontingent erneuert
											oder erweitert wird.
										</p>
									</div>
									<p>
										Die genauen Preise, Kontingentgrößen und verfügbaren
										Abonnement-Optionen sind auf der Website einsehbar.
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
										weitergegeben werden.
									</p>
									<div className="rounded-lg border border-solarized-red bg-solarized-base2 p-3 dark:border-solarized-orange dark:bg-solarized-base01">
										<div className="flex items-start space-x-2">
											<div className="flex-shrink-0">
												<AlertTriangle className="h-4 w-4 text-solarized-red dark:text-solarized-orange" />
											</div>
											<div>
												<p className="font-medium text-sm text-solarized-red dark:text-solarized-orange">
													Besonders wichtig bei KI-Funktionen:
												</p>
												<p className="text-solarized-base01 text-xs dark:text-solarized-base1">
													Da Eingabedaten an externe KI-Anbieter übertragen
													werden, dürfen NIEMALS personenbezogene
													Gesundheitsdaten, Patientennamen oder andere
													identifizierbare Informationen eingegeben werden.
													Erlaubt sind ausschließlich anonymisierte Inhalte und
													allgemeine Stichpunkte.
												</p>
											</div>
										</div>
									</div>
									<p>
										Ein Verstoß gegen diese Pflichten, insbesondere die Eingabe
										personenbezogener Daten, kann zur sofortigen Sperrung des
										Accounts führen.
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
									<h4 className="font-medium">
										8. Haftung und medizinischer Disclaimer
									</h4>
									<div className="rounded-lg border border-solarized-red bg-solarized-base2 p-4 dark:border-solarized-orange dark:bg-solarized-base01">
										<div className="flex items-start space-x-3">
											<div className="flex-shrink-0">
												<Shield className="h-5 w-5 text-solarized-red dark:text-solarized-orange" />
											</div>
											<div>
												<p className="font-semibold text-solarized-red dark:text-solarized-orange">
													WICHTIGER MEDIZINISCHER DISCLAIMER:
												</p>
												<p className="text-sm text-solarized-base01 dark:text-solarized-base1">
													mdscribe.de ist KEIN Medizinprodukt und bietet KEINE
													medizinische Beratung, Diagnose oder
													Behandlungsempfehlungen. Die Plattform dient
													ausschließlich als technisches Hilfsmittel zur
													Vereinfachung der Dokumentation und Textgenerierung.
												</p>
											</div>
										</div>
									</div>
									<p>
										<strong>Zweck und Grenzen der Plattform:</strong> Die
										generierten Inhalte sind ausschließlich als
										Dokumentationshilfe gedacht und müssen stets durch
										qualifizierte medizinische Fachkräfte überprüft, angepasst
										und verantwortet werden. Alle medizinischen Entscheidungen
										bleiben vollständig in der Verantwortung der behandelnden
										Ärzte.
									</p>
									<p>
										<strong>Keine Haftung für medizinische Inhalte:</strong> Für
										die Richtigkeit, Vollständigkeit, Anwendbarkeit oder
										medizinische Korrektheit der generierten Inhalte übernimmt
										mdscribe.de keine Haftung. Die Nutzung erfolgt
										ausschließlich auf eigene Verantwortung des Anwenders.
									</p>
									<p>
										<strong>Allgemeine Haftungsbeschränkung:</strong> Eine
										Haftung für leichte Fahrlässigkeit ist ausgeschlossen, außer
										bei Verletzung wesentlicher Vertragspflichten, bei Schäden
										aus der Verletzung des Lebens, des Körpers oder der
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
