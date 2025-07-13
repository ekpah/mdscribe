import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/design-system/components/ui/breadcrumb';
import { SidebarTrigger } from '@repo/design-system/components/ui/sidebar';
import Link from 'next/link';
import ContentSection from './[id]/_components/ContentSection';
import { NavActions } from './[id]/_components/NavActions';
export default function TemplatesPage() {
  const templateGuide = `# Template-Möglichkeiten

Willkommen in der Template-Bibliothek! Hier kannst du dynamische Textbausteine erstellen, die sich automatisch an verschiedene Patientendaten anpassen. Templates verwenden spezielle Tags, um interaktive Eingabefelder zu definieren und berechnete Werte zu erstellen.

Möchtest du die Tag-Möglichkeiten direkt ausprobieren? Besuche den [Playground](/playground) für interaktive Experimente!

## Gestaltungsmöglichkeiten

Templates bestehen aus normalem Text kombiniert mit speziellen Platzhaltern, die Eingabefelder und dynamische Inhalte erzeugen. Jeder Platzhalter-Typ (Tag) hat einen spezifischen Zweck und eine eigene Syntax.

### 1. Info-Tags
Info-Tags erstellen Eingabefelder für einzelne Werte. Du kannst verschiedene Datentypen definieren und Einheiten hinzufügen. Der Tag erscheint sowohl als Eingabefeld im linken Panel als auch als Platzhalter im Text.

**Beispiel - Entlassungsbrief:**

Der Patient {% info "Patientenname" /%} konnte heute in gutem Allgemeinzustand in den ambulanten Bereich entlassen werden. Die weitere Betreuung erfolgt hausärztlich.

### 2. Switch-Tags
Switch-Tags ermöglichen bedingte Textausgabe basierend auf Benutzerauswahl. Definiere verschiedene Fälle mit Case-Tags innerhalb eines Switch-Tags. Nur der Inhalt des ausgewählten Falls wird angezeigt.

**Beispiel - PTCA-Nachbehandlung:**

Es wurde eine erfolgreiche PTCA der LAD mit Stentimplantation durchgeführt. {% switch "DAPT-Therapie" %}{% case "Clopidogrel" %}Empfohlene duale Plättchenhemmung mit ASS 100mg und Clopidogrel 75mg täglich für 12 Monate. Esomeprazol sollte aufgrund der Interaktion mit Clopidogrel vermieden werden.{% /case %}{% case "Ticagrelor" %}Empfohlene duale Plättchenhemmung mit ASS 100mg und Ticagrelor 90mg 2x täglich für 12 Monate.{% /case %}{% case "Prasugrel" %}Empfohlene duale Plättchenhemmung mit ASS 100mg und Prasugrel 10mg täglich für 12 Monate.{% /case %}{% /switch %}

### 3. Score-Tags
Score-Tags berechnen automatisch Werte basierend auf mathematischen Formeln. Verwende eckige Klammern um auf andere Info-Tag-Werte zu verweisen. Die Berechnung erfolgt in Echtzeit bei Eingabeänderungen.

**Beispiel - Diagnoseblock:**

- Adipositas Grad II (BMI {% score formula="[Patientengewicht]/(([Patientengroesse]/100)^2)" unit="kg/m²" /%})
- Arterielle Hypertonie
- Diabetes mellitus Typ 2

**Körperliche Untersuchung:**
Größe: {% info "Patientengroesse" type="number" unit="cm" renderUnit=true /%}, Gewicht: {% info "Patientengewicht" type="number" unit="kg" renderUnit=true /%}, BMI: {% score "BMI" formula="[Patientengewicht]/(([Patientengroesse]/100)^2)" unit="kg/m²" renderUnit=true /%}

**Erstelle jetzt dein eigenes Template und spar dir viel Zeit bei deinen künftigen Arztbriefen!**`;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <SidebarTrigger className="ml-4 block md:hidden" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <Link href="/templates">Textbausteine</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>...</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NavActions
          favouriteOfCount={0}
          isFavourite={false}
          isLoggedIn={false}
          lastEdited={new Date()}
          templateId={''}
        />
      </div>
      <ContentSection inputTags={JSON.stringify([])} note={templateGuide} />
    </div>
  );
}
