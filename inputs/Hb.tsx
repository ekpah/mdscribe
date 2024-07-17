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
export default function Hb() {
  const { register } = useFormContext();
  return (
    <FormItem className="space-y-3">
      <FormLabel>Hämoglobin [g/dl] </FormLabel>
      <Input {...register("Hb")} placeholder="Hb [g/dl]" />
    </FormItem>
  );
}
