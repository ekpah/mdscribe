"use client";
import { uniq } from "lodash";
import Link from "next/link";
export default function Sidebar() {
  // console.log(listTemplates());
  const segments = [
    {
      category: "Gastroenterologie",
      documents: ["Colitis-Ulcerosa", "Alkoholentzug"],
    },
    {
      category: "Kardiologie",
      documents: [
        "STEMI",
        "TAVI",
        "TAVI-Vorbereitung",
        "Schrittmacher",
        "Schrittmacher-Aggregat-Wechsel",
        "PTSMA",
        "PVI",
        "PFO-Verschluss",
        "PCI",
        "Mitraclip",
        "Kardioversion",
        "Kardiale-Dekompensation",
        "Ausschluss-KHK",
      ],
    },
  ];

  return (
    <div
      key="Sidebar"
      className="items-left flex h-full w-full flex-col justify-start py-6 pl-2"
    >
      <div
        id="menu1"
        className="flex w-full flex-col items-start justify-start pb-1 md:w-auto"
      >
        {segments.map((segment, index) => {
          const path = `/templates/${segment.category}`;
          console.log(path);
          return (
            <div key={index}>
              <Link href={path} className="text-xl font-bold leading-5">
                {segment.category || "Diverses"}
              </Link>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
