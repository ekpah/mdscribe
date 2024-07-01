"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
export default function Sidebar({ segments, category, template }) {
  const menuSegments = JSON.parse(segments);
  return (
    <div
      key="Sidebar"
      className="items-left h-[calc(100vh-theme(spacing.16))] w-full justify-start py-4 px-2 overflow-y-scroll custom-scrollbar"
      style={{ scrollbarWidth: "none" }}
    >
      <div
        id="menu1"
        className="flex w-full flex-col items-start justify-start pb-1 md:w-auto"
      >
        {" "}
        <Accordion
          type="single"
          collapsible
          className="w-full"
          defaultValue={category}
        >
          {menuSegments.map((segment, index) => {
            const path = `/templates/${segment.category}`;

            return (
              <div key={index}>
                <AccordionItem value={segment.category} className="text-xl ">
                  <AccordionTrigger>
                    {" "}
                    {segment.category || "Diverses"}
                  </AccordionTrigger>
                  <AccordionContent>
                    {segment.documents.map((name, index) => {
                      const docPath = path + `/${name}`;
                      return (
                        <Link
                          className=" flex w-full items-center justify-start space-x-6 rounded px-3 py-2 hover:bg-gray-700 focus:bg-gray-700 md:w-52"
                          href={docPath}
                          key={index}
                        >
                          {name}
                        </Link>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              </div>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
