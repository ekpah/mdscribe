"use client";

import { useInfoStore } from "@/state/infoStoreProvider";

export default function Switch({ variable, children }) {
  // TODO: error, if variable does not exist
  const gender = useInfoStore((state) => state.gender);
  const info = useInfoStore((state) => state[variable]);
  console.log(children);
  const child = children.find(
    (child) => child.attributes?.primary === variable
  );
  console.log(child);

  return (
    <span>
      {gender}: {child}
    </span>
  );
}
