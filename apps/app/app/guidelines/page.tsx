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
export default function GuidelinesPage() {
  const guidelineGuide = `# Guidelines - Wissen teilen und bewahren

Willkommen in der Guidelines-Bibliothek! Hier kannst du medizinisches Wissen, Prozesse und Best Practices dokumentieren und mit anderen teilen. Guidelines sind ideal für:

- **Prozessbeschreibungen**: Arbeitsabläufe und Standardprozeduren
- **Best Practices**: Bewährte Vorgehensweisen aus dem klinischen Alltag
- **Wissenssammlung**: Strukturiertes medizinisches Fachwissen
- **Klinische Leitlinien**: Zusammenfassungen und Adaptionen von Leitlinien

## Unterschied zu Textbausteinen

Während **Textbausteine** dynamische Vorlagen mit Platzhaltern für die Dokumentenerstellung sind, dienen **Guidelines** der Wissensvermittlung und Prozessdokumentation. Guidelines enthalten:

- Strukturiertes Fachwissen
- Schritt-für-Schritt-Anleitungen
- Entscheidungshilfen
- Hintergrundinformationen

## Gestaltungsmöglichkeiten

Guidelines können ebenfalls Markdown und spezielle Tags verwenden, wobei der Fokus auf der klaren Darstellung von Wissen liegt:

### Strukturierung

Nutze Überschriften, Listen und Tabellen für eine klare Struktur:

**Beispiel - Antibiotikatherapie bei Pneumonie:**

## Ambulant erworbene Pneumonie - Therapieschema

### CRB-65 Score < 1 (ambulante Therapie)
- Amoxicillin 1g 3x täglich
- Therapiedauer: 5-7 Tage
- Kontrolle nach 48-72h

### CRB-65 Score ≥ 1 (stationäre Aufnahme)
- Amoxicillin/Clavulansäure 2,2g i.v. 3x täglich
- Bei Makrolid-Resistenz: plus Azithromycin
- Therapiedauer: 7-10 Tage

### Eskalation bei schwerem Verlauf
- Piperacillin/Tazobactam 4,5g i.v. 3x täglich
- plus Makrolid

**Erstelle jetzt deine eigene Guideline und teile dein Wissen!**`;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <SidebarTrigger className="ml-4 block md:hidden" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <Link href="/guidelines">Guidelines</Link>
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
          guidelineId={''}
        />
      </div>
      <ContentSection inputTags={JSON.stringify([])} note={guidelineGuide} />
    </div>
  );
}
