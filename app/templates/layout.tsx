import Sidebar from "@/components/navigation/Sidebar";
import Template from "@/components/templates/Template";

// input Data const inputData = writable({ test: 'testfirstentry' });
// input Componentsconst inputComponents = writable([]);
// setContext('inputData', inputData);
// setContext('inputComponents', inputComponents);
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-16 flex h-[calc(100vh-theme(spacing.16))] w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60">
        <Sidebar />
      </aside>

      <main className="w-[calc(100vw-theme(spacing.60))] flex-1 overflow-y-auto">
        <Template>{children}</Template>
      </main>
    </div>
  );
}
