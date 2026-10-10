"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import { BookOpen, Code2, ListTree, Sparkles } from "lucide-react";

export const TagInspectorHelp = () => (
	<div className="space-y-4">
		{/* Header */}
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<BookOpen className="h-5 w-5 text-solarized-blue" />
				<h3 className="font-semibold text-lg">Editor-Hilfe</h3>
			</div>
			<p className="text-muted-foreground text-sm">
				Nutzen Sie Tags und KI-Hinweise für dynamische Templates. Klicken Sie auf ein Tag im Editor,
				um seine Eigenschaften hier zu bearbeiten.
			</p>
		</div>

		<Separator />

		{/* AI Guidance Section */}
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Sparkles className="h-4 w-4 text-solarized-violet" />
				<h4 className="font-semibold text-sm">KI-Anleitung</h4>
			</div>

			<div className="space-y-3 rounded-lg bg-solarized-violet/5 p-3">
				{/* Double Brackets */}
				<div className="space-y-1.5">
					<div className="flex items-center gap-2">
						<Badge
							className="border-solarized-violet bg-solarized-violet/10 font-mono text-solarized-violet text-xs"
							variant="outline"
						>
							((…))
						</Badge>
						<span className="font-medium text-xs">KI-Hinweise</span>
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Doppelte Klammern sind die empfohlene Syntax für{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">((Hinweise))</code> im
						Template. Diese sind ausgegraut sichtbar, werden aber beim Kopieren entfernt.
					</p>
					<div className="mt-2 rounded border border-solarized-violet/20 bg-background p-2">
						<p className="font-mono text-muted-foreground text-xs">
							Beispiel: ((Beschreibe den Befund detailliert))
						</p>
					</div>
				</div>
			</div>
		</div>

		<Separator />

		{/* Tags Accordion */}
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Code2 className="h-4 w-4 text-solarized-green" />
				<h4 className="font-semibold text-sm">Verfügbare Tags</h4>
			</div>

			<Accordion className="w-full" multiple={false}>
				{/* Info Tag */}
				<AccordionItem value="info">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-blue text-xs">Info</Badge>
							<span className="text-xs">Eingabe-Tag</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Fügt einen Wert ein, der im Eingabebereich ausgefüllt wird. Tags mit demselben Namen
							teilen sich einen Wert, auch wenn sie in einem Fall stehen.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-blue">
									{'{% info "Gewicht" type="number" unit="kg" /%}'}
								</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Switch Tag */}
				<AccordionItem value="switch">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-green text-xs">Switch</Badge>
							<span className="text-xs">Auswahl-Tag</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Zeigt je nach ausgewählter Option einen anderen Text, als Auswahl oder mit{" "}
							<code className="rounded bg-muted px-1 font-mono">type="checkbox"</code> als Häkchen.
							Switches mit demselben Namen sind eine Eingabe mit allen ihren Optionen.
						</p>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Für Berechnungen erhält jede Option mit{" "}
							<code className="rounded bg-muted px-1 font-mono">value</code> eine Zahl, die für alle
							gleichnamigen Switches gilt. Checkboxen zählen ohne Angabe als 1 und 0. Ein{" "}
							<code className="rounded bg-muted px-1 font-mono">default=true</code>-Fall ist nur die
							Textalternative. Zahlenvergleiche gehören in einen Condition-Tag.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-green">{'{% switch "Raucher" %}'}</span>
								<br />
								<span className="ml-2 text-solarized-cyan">{'{% case "ja" value=1 %}'}</span>
								<span className="text-muted-foreground">Raucher</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
								<br />
								<span className="ml-2 text-solarized-cyan">{'{% case "nein" value=0 %}'}</span>
								<span className="text-muted-foreground">Nichtraucher</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
								<br />
								<span className="text-solarized-green">{"{% /switch %}"}</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Condition Tag */}
				<AccordionItem value="condition">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-cyan text-xs">Condition</Badge>
							<span className="text-xs">Zahlen-Bedingung</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Zeigt Text abhängig von Zahlenwerten. Verglichen wird mit „gleich“ (eq), „größer als“
							(gt), „mindestens“ (gte), „kleiner als“ (lt) und „höchstens“ (lte). Alle Vergleiche
							eines Falls müssen zutreffen, der erste passende Fall wird angezeigt, und „Sonst“
							gehört ans Ende.
						</p>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Mehrere Felder werden als Liste angegeben; jeder Vergleich hat dann einen Wert pro
							Feld, <code className="rounded bg-muted px-1 font-mono">null</code> überspringt ein
							Feld. Für ein „oder“ einfach mehrere Fälle anlegen. Unbekannte Felder werden zu
							Zahleneingaben.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-cyan">{'{% condition ["IVSd", "LVPWd"] %}'}</span>
								<br />
								<span className="ml-2 text-solarized-cyan">{"{% case gt=[11,null] %}"}</span>
								<span className="text-muted-foreground">hypertrophiert</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
								<br />
								<span className="ml-2 text-solarized-cyan">{"{% case gt=[null,11] %}"}</span>
								<span className="text-muted-foreground">hypertrophiert</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
								<br />
								<span className="ml-2 text-solarized-cyan">{"{% case default=true %}"}</span>
								<span className="text-muted-foreground">normal</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
								<br />
								<span className="text-solarized-cyan">{"{% /condition %}"}</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Case Tag */}
				<AccordionItem value="case">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-cyan text-xs">Case</Badge>
							<span className="text-xs">Fall-Tag (in Switch oder Condition)</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Ein einzelner Fall mit seinem Text: im Switch eine Option, in der Condition ein
							Vergleich. Die Fälle lassen sich im Editor über die Tabs des aufgeklappten Tags
							bearbeiten.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-cyan">{'{% case "wert" %}'}</span>
								<span className="text-muted-foreground">Inhalt für diesen Fall</span>
								<span className="text-solarized-cyan">{"{% /case %}"}</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Calc Tag */}
				<AccordionItem value="calc">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-orange text-xs">Calc</Badge>
							<span className="text-xs">Berechnungs-Tag</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Berechnet einen Wert aus einer Formel; Felder stehen in eckigen Klammern und
							Info-Felder in einer Formel brauchen type="number". Jede Berechnung braucht einen
							Namen und wird immer berechnet, auch in zugeklappten oder nicht gewählten Fällen,
							sobald alle Werte der Formel ausgefüllt sind; bis dahin steht „…“ da. Ein eingegebener
							Wert überschreibt das Ergebnis, bis er zurückgesetzt wird.
						</p>
						<p className="text-muted-foreground text-xs leading-relaxed">
							Das gerundete Ergebnis (<code className="rounded bg-muted px-1 font-mono">round</code>
							, Standard 2 Stellen) verwenden auch andere Berechnungen und Conditions. Nutzt eine
							Formel eine andere Berechnung, verweist „berechnet ↗“ im Eingabebereich darauf.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-orange">
									{'{% calc "BMI" formula="[Gewicht] / ([Groesse] / 100) ^ 2" unit="kg/m²" /%}'}
								</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Details Tag */}
				<AccordionItem value="details">
					<AccordionTrigger className="py-2 text-sm hover:no-underline">
						<div className="flex items-center gap-2">
							<Badge className="bg-solarized-violet text-xs">Details</Badge>
							<span className="text-xs">Aufklappbarer Abschnitt</span>
						</div>
					</AccordionTrigger>
					<AccordionContent className="space-y-2 pt-1 pb-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							Fasst Inhalt in einem aufklappbaren Abschnitt zusammen, wie auf GitHub. Die
							Beschriftung ist optional.
						</p>
						<div className="rounded bg-muted p-2">
							<p className="font-mono text-xs">
								<span className="text-solarized-violet">
									{'{% details summary="Laborwerte" %}'}
								</span>
								<br />
								<span className="text-muted-foreground">Inhalt des Abschnitts</span>
								<br />
								<span className="text-solarized-violet">{"{% /details %}"}</span>
							</p>
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>

		<Separator />

		{/* Quick Tips */}
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<ListTree className="h-4 w-4 text-solarized-cyan" />
				<h4 className="font-semibold text-sm">Schnelltipps</h4>
			</div>
			<ul className="space-y-1.5 text-muted-foreground text-xs">
				<li className="flex items-start gap-2">
					<span className="text-solarized-cyan">•</span>
					<span>Klicken Sie auf ein Tag, um seine Eigenschaften zu bearbeiten</span>
				</li>
				<li className="flex items-start gap-2">
					<span className="text-solarized-cyan">•</span>
					<span>
						Switch und Condition klappen beim Anklicken auf: Die Fall-Texte stehen in Tabs im
						Dokument, Optionen und Vergleiche rechts.
					</span>
				</li>
			</ul>
		</div>
	</div>
);
