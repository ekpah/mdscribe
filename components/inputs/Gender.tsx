"use client";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useInfoStore } from "@/state/infoStoreProvider";

export default function () {
  const gender = useInfoStore((state) => state.gender);
  const setMale = useInfoStore((state) => state.setGenderMale);
  const setFemale = useInfoStore((state) => state.setGenderFemale);
  return (
    <RadioGroup value={gender}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem onClick={setMale} value="male" id="male" />
        <Label htmlFor="option-one">Männlich</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem onClick={setFemale} value="female" id="female" />
        <Label htmlFor="option-two">Weiblich</Label>
      </div>
    </RadioGroup>
  );
}
