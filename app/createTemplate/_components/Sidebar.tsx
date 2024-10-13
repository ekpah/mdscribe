"use client";

import { Input } from "@/components/ui/input";

import Fuse from "fuse.js";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useState } from "react";

const generateSegments = (templates) => {
  const segments = templates.reduce((acc, current) => {
    const category = current.category;
    const template = current.template;
    const route = current.route;

    const existingCategory = acc.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push({ template: template, route: route });
    } else {
      acc.push({ category, documents: [{ template: template, route: route }] });
    }

    return acc;
  }, []);

  return segments;
};

export default function Sidebar({ templates }) {
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // 1. List of items to search in
  const menuSegments = JSON.parse(templates);

  // 2. Set up the Fuse instance
  const fuse = new Fuse(menuSegments, {
    keys: ["category", "template"],
  });

  // 3. Now search!
  const filteredLinks = fuse
    .search(searchTerm, { limit: 5 })
    .map((res) => res.item);

  // generate ordered segments to be visualized in the sidebar
  const orderedSegments = generateSegments(
    searchTerm ? filteredLinks : menuSegments
  );

  return (
    <div
      key="Sidebar"
      className="items-left h-[calc(100vh-theme(spacing.16))] w-full justify-start py-4 px-2 overflow-y-scroll custom-scrollbar"
      style={{ scrollbarWidth: "none" }}
    >
      <aside
        key="aside-Sidebar"
        className="flex w-full flex-col items-start justify-between bg-background shadow-sm md:w-64"
      >
        <div key="searchBar" className="w-52 fixed">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearch}
            className="rounded-md bg-muted pl-8 text-sm"
          />
        </div>
        <div
          key="navLinks"
          className="flex w-full flex-col items-start gap-6 mt-8"
        >
          <nav className="flex w-full flex-col gap-1 mt-4">
            {orderedSegments.map((segment, index) => {
              return (
                <div key={segment.category}>
                  <span className="text-lg font-semibold">
                    {segment.category || "Diverses"}
                  </span>
                  {segment.documents.map((name, index) => {
                    return (
                      <Link
                        className={`flex w-full items-center font-light justify-start space-x-6 rounded px-3 py-2 hover:bg-gray-700 focus:bg-gray-700 md:w-52 ${
                          pathname === `/createTemplate/${name.route}`
                            ? "bg-muted"
                            : ""
                        }`}
                        href={`/createTemplate/${name.route}`}
                        key={index}
                      >
                        {name.template}
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
