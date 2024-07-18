"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gender, inputComponents } from "@/inputs/index.js";
import { RadioGroup } from "@radix-ui/react-dropdown-menu";
import { RadioGroupItem } from "@radix-ui/react-radio-group";
import { createElement } from "react";

import React from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";

export default function Inputs({ inputs, onChange, initialFields = [] }) {
  const parsedInputs = JSON.parse(inputs);
  const validInputs = inputs
    ? parsedInputs.filter((key) => inputComponents[key])
    : [];

  const neededComponents = validInputs.map(
    (comp) => inputComponents[comp] || ""
  );

  const methods = useForm();

  return (
    <div key="inputs">
      <h1>Notwendige Eingaben</h1>
      <FormProvider {...methods}>
        <form onChange={methods.handleSubmit(onChange)} className="space-y-6">
          {neededComponents.map((Component) => {
            return (
              <Card key={Component.name} className="p-4 m-4 bg-secondary">
                <Component />
              </Card>
            );
          })}
        </form>
      </FormProvider>
    </div>
  );
}
