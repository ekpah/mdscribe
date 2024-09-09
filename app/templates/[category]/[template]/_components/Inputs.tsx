"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

import React from "react";
import { FormProvider, useForm } from "react-hook-form";

export default function Inputs({ inputTags, onChange }) {
  const parsedInputTags = JSON.parse(inputTags);

  const methods = useForm();

  return (
    <div key="inputs">
      <span className="text-xl font-bold">Notwendige Eingaben</span>
      <Separator />
      <FormProvider {...methods}>
        <form onChange={methods.handleSubmit(onChange)} className="space-y-6">
          {parsedInputTags.infoTags.map((variable) => {
            return (
              <Card key={variable} className="p-4 m-4 bg-secondary">
                <FormItem className="space-y-3">
                  <FormLabel>{variable} </FormLabel>
                  <Input {...methods.register(variable)} />
                </FormItem>
              </Card>
            );
          })}
          {parsedInputTags.switchTags.map((select) => {
            const variable = methods.watch(select.variable);
            return (
              <Card key={select.variable} className="p-4 m-4 bg-secondary">
                <FormItem className="space-y-3">
                  <FormLabel>{select.variable}</FormLabel>
                  <RadioGroup
                    className="flex flex-col space-y-1"
                    value={variable}
                  >
                    {select.options.map((option) => (
                      <FormItem
                        key={option}
                        className="flex items-center space-x-3 space-y-0"
                      >
                        <RadioGroupItem
                          className="w-5 h-5 rounded-full border border-gray-300"
                          value={option}
                          id={`${select.variable}-${option}`}
                          onClick={() =>
                            methods.setValue(select.variable, option)
                          }
                        ></RadioGroupItem>
                        <label
                          className="text-sm"
                          htmlFor={`${select.variable}-${option}`}
                        >
                          {option}
                        </label>
                      </FormItem>
                    ))}
                  </RadioGroup>
                  <FormMessage />
                </FormItem>
              </Card>
            );
          })}
        </form>
      </FormProvider>
    </div>
  );
}
