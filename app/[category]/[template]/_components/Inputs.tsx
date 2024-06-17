"use client";
import { Card } from "@/components/ui/card";
import { inputComponents } from "@/inputs/index.js";

export default function Inputs({ inputs }) {
  const validInputs = inputs.filter((key) => inputComponents[key]);

  const neededComponents = validInputs.map(
    (comp) => inputComponents[comp] || ""
  );
  const renderedComponents = neededComponents.map((res) => res() || "");
  return (
    <div key="inputs">
      <h1>Notwendige Eingaben</h1>
      {neededComponents.map((component) => (
        <Card key={component.name} className="p-4 m-4 bg-secondary">
          {component()}
        </Card>
      ))}
    </div>
  );
}
