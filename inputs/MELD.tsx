"use client";
import { formAtom } from "@/app/templates/[category]/[template]/_components/ContentSection";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAtom, useAtomValue } from "jotai";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
const calculateMeld = ({
  gender = "undefined",
  bilirubin = 1,
  natrium = 1,
  inr = 1,
  creatinine = 1,
  albumin = 1,
}) => {
  const meldScore = Math.round(
    (gender === "female" ? 1.33 : 1) +
      (4.56 * Math.log(bilirubin) + 0.82 * (137 - natrium)) -
      (0.24 * (137 - natrium) + Math.log(bilirubin)) +
      (9.09 * Math.log(inr) +
        11.14 * Math.log(creatinine) +
        1.85 * (3.5 - albumin) -
        1.83 * (3.5 - albumin) * Math.log(creatinine) +
        6)
  );
  return meldScore;
};

export default function MELD() {
  const { register, setValue, watch } = useFormContext();
  const gender = watch("gender");
  const meld = calculateMeld({
    gender: watch("gender"),
    bilirubin: watch("bilirubin"),
    natrium: watch("natrium"),
    inr: watch("inr"),
    creatinine: watch("creatinine"),
    albumin: watch("albumin"),
  });
  return (
    <>
      {/* Header for input component */}
      <span className="font-bold text-xl mb-12">MELD 3.0 Score: {meld}</span>
      {/* Inputs */}
      {/* gender */}
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
      <br />
      {/* bilirubin */}
      {/* value={bilirubin} onChange={(e) => updateName(e.target.value)} */}
      <div id="bilirubin-input">
        <Label htmlFor="bilirubin">Bilirubin [mg/dl]</Label>
        <Input {...register("Bili")} id="bilirubin" placeholder="Bilirubin" />
      </div>
      {/* Natrium mmol/L*/}
      <div id="natrium-input">
        <Label htmlFor="natrium">Natrium [mmol/L]</Label>
        <Input {...register("natrium")} id="natrium" placeholder="Natrium" />
      </div>
      {/* INR */}
      <div id="inr-input">
        <Label htmlFor="inr">INR</Label>
        <Input {...register("inr")} id="inr" placeholder="INR" />
      </div>
      {/* Creatinin */}
      <div id="crea-input">
        <Label htmlFor="inr">Kreatinin [mg/dL]</Label>
        <Input {...register("crea")} id="crea" placeholder="Kreatinin" />
      </div>
      {/* Albumin g/dL */}
      <div id="crea-input">
        <Label htmlFor="albumin">Albumin [g/dL]</Label>
        <Input {...register("albumin")} id="albumin" placeholder="Albumin" />
      </div>
    </>
  );
}
