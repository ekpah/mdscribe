import { Separator } from '@repo/design-system/components/ui/separator';
const date = new Date().getFullYear();
export default function Footer() {
  const date = new Date().getFullYear();
  return (
    <footer className="fixed bottom-0 z-30 h-8 w-full items-center border-t bg-background p-2 text-center">
      <div className="flex h-full items-center justify-center text-xs">
        <div className="flex flex-row gap-2">
          Copyright ©{date}
          <Separator orientation="vertical" />
          <a href="/legal" className="hover:underline">
            Impressum und Nutzungsbedingungen
          </a>
        </div>
      </div>
    </footer>
  );
}
