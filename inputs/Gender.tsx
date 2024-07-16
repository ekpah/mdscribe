"use client";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { formAtom } from "@/app/templates/[category]/[template]/_components/ContentSection";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormProvider, useForm, useFormContext } from "react-hook-form";

export default function Gender({ methods }) {
  const { register, watch, setValue } = useFormContext();
  const gender = watch("gender");
  return (
    <FormItem className="space-y-3">
      <FormLabel>Geschlecht des Patienten</FormLabel>
      <RadioGroup className="flex flex-col space-y-1" value={gender}>
        <FormItem className="flex items-center space-x-3 space-y-0">
          <RadioGroupItem
            onClick={() => setValue("gender", "male")}
            value="male"
          />
          <FormLabel className="font-normal">Männlich</FormLabel>
        </FormItem>
        <FormItem className="flex items-center space-x-3 space-y-0">
          <RadioGroupItem
            onClick={() => setValue("gender", "female")}
            value="female"
          />
          <FormLabel className="font-normal">Weiblich</FormLabel>
        </FormItem>
      </RadioGroup>
      <FormMessage />
    </FormItem>
  );
}
