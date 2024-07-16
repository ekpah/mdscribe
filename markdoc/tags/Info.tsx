"use client";

import { formAtom } from "@/app/templates/[category]/[template]/_components/ContentSection";

import { useAtom, useAtomValue } from "jotai";

export function Info({ primary, variable }) {
  // TODO: error, if variable does not exist
  const data = useAtomValue(formAtom);
  return <>{data[primary] || ""}</>;
}
