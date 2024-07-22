"use client";
import { Input } from "@/components/ui/input";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";
export default function dischargeWeight() {
  const { register } = useFormContext();
  return (
    <FormItem className="space-y-3">
      <FormLabel>Entlassgewicht</FormLabel>
      <Input
        {...register("discharge-weight")}
        placeholder="Entlassgewicht [kg]"
      />{" "}
    </FormItem>
  );
}
