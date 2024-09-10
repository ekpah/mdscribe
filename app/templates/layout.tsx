import { globSync } from "glob";
import Sidebar from "./[category]/[template]/_components/Sidebar";

const getTemplates = () => {
  const res = globSync("./templates/**/*.md");
  const templates = res.map((temp) => ({
    route: temp,
    category: temp.split("/")[1],
    template: temp.split("/")[2].replace(".md", ""),
  }));
  return templates;
};

export default function Layout({ children }: { children: React.ReactNode }) {
  let templates = getTemplates();

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] w-full">
      <aside
        key="Sidebar"
        className="sticky top-16 flex h-full w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60"
      >
        <Sidebar segments={JSON.stringify(templates)} />
      </aside>
      <main
        key="MainContent"
        className="w-[calc(100vw-theme(spacing.60))] flex-1 overflow-y-auto overscroll-none"
      >
        {children}
      </main>
    </div>
  );
}
