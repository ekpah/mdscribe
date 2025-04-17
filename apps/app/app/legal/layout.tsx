import { Separator } from '@repo/design-system/components/ui/separator';
import Footer from '../_components/landing/Footer';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full overflow-x-hidden">
      <div className="items-center py-6 md:py-10">
        <div className="mx-auto mb-16 w-2/3 space-y-6">
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Rechtliches</h1>
            <p className="text-muted-foreground">
              Impressum und Datenschutzerklärung
            </p>
          </div>
          <Separator />
          {children}
        </div>
      </div>
      <Footer />
    </div>
  );
}
