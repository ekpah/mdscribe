"use client";
import { inputComponents } from "@/inputs/index.js";

export default function Inputs({ inputs }) {
  const validInputs = inputs.filter((key) => inputComponents[key]);

  const neededComponents = validInputs.map(
    (comp) => inputComponents[comp] || ""
  );
  const renderedComponents = neededComponents.map((res) => res() || "");
  return (
    <div key="inputs">
      {neededComponents.map((component) => (
        <div key={component.name}>{component()}</div>
      ))}
    </div>
  );
}
