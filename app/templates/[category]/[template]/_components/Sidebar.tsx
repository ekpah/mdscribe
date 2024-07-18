"use client";

import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
export default function Sidebar({ segments, category, template }) {
  const menuSegments = JSON.parse(segments);
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  const filteredLinks = useMemo(() => {
    const regex = new RegExp(searchTerm, "i");
    return [
      { href: "/", label: "Home" },
      { href: "#", label: "Dashboard" },
      { href: "#", label: "Orders", isActive: true },
      { href: "#", label: "Products" },
      { href: "#", label: "Customers" },
      { href: "#", label: "Analytics" },
    ].filter((link) => regex.test(link.label));
  }, [searchTerm]);
  return (
    <div
      key="Sidebar"
      className="items-left h-[calc(100vh-theme(spacing.16))] w-full justify-start py-4 px-2 overflow-y-scroll custom-scrollbar"
      style={{ scrollbarWidth: "none" }}
    >
      <aside className="flex w-full flex-col items-start justify-between bg-background shadow-sm md:w-64">
        <div className="w-52 relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearch}
            className="rounded-md bg-muted pl-8 text-sm"
          />
        </div>
        <div className="flex w-full flex-col items-start gap-6">
          <nav className="flex w-full flex-col gap-1 mt-4">
            {menuSegments.map((segment, index) => {
              const path = `/templates/${segment.category}`;
              return (
                <div>
                  <span className="text-lg font-semibold">
                    {segment.category || "Diverses"}
                  </span>
                  {segment.documents.map((name, index) => {
                    const docPath = path + `/${name}`;
                    return (
                      <Link
                        className={`flex w-full items-center font-light justify-start space-x-6 rounded px-3 py-2 hover:bg-gray-700 focus:bg-gray-700 md:w-52 ${
                          pathname === docPath ? "bg-muted" : ""
                        }`}
                        href={docPath}
                        key={index}
                      >
                        {name}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}
