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
export default function Name() {
  const { register } = useFormContext();
  return (
    <FormItem className="space-y-3">
      <FormLabel>Name des Patienten </FormLabel>
      <Input {...register("name")} placeholder="Nachname" />{" "}
    </FormItem>
  );
}
