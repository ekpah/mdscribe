"use client";
import Link from "next/link";

export default function Sidebar() {
  const segments = [
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
  ];
  return (
    <div className="items-left flex h-full w-full flex-col justify-start py-6 pl-2">
      <div
        id="menu1"
        className="flex w-full flex-col items-start justify-start pb-1 md:w-auto"
      >
        <Link href="/templates/kardiologie" className="pb-5 text-xl leading-5">
          Kardiologie
        </Link>
        {segments.map((segment, index) => {
          const path = `/templates/kardiologie/${segment}`;
          return (
            <Link
              className=" flex w-full items-center justify-start space-x-6 rounded px-3 py-2 hover:bg-gray-700 focus:bg-gray-700 md:w-52"
              href={path}
              key={index}
            >
              {" "}
              {segment}{" "}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
