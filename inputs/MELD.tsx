"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useInfoStore } from "@/state/infoStoreProvider";

const calculateMeld = (
  gender = "undefined",
  bilirubin = 0,
  natrium = 0,
  inr = 0,
  creatinine = 0,
  albumin = 0
) => {
  const meldScore = Math.round(
    (gender == "female" ? 1.33 : 1) +
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
  const name = useInfoStore((state) => state.name);
  const updateName = useInfoStore((state) => state.updateName);
  const gender = useInfoStore((state) => state.gender);
  const setMale = useInfoStore((state) => state.setGenderMale);
  const setFemale = useInfoStore((state) => state.setGenderFemale);
  return (
    <>
      {/* Header for input component */}
      <span className="font-bold text-xl mb-12">MELD 3.0 Score</span>
      {/* Inputs */}
      {/* gender */}
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
      <br />
      {/* bilirubin */}
      {/* value={bilirubin} onChange={(e) => updateName(e.target.value)} */}
      <div id="bilirubin-input">
        <Label htmlFor="bilirubin">Bilirubin [mg/dl]</Label>
        <Input
          onChange={(e) => updateName(e.target.value)}
          id="bilirubin"
          placeholder="Bilirubin"
        />
      </div>
      {/* Natrium mmol/L*/}
      <div id="natrium-input">
        <Label htmlFor="natrium">Natrium [mmol/L]</Label>
        <Input
          onChange={(e) => updateName(e.target.value)}
          id="natrium"
          placeholder="Natrium"
        />
      </div>
      {/* INR */}
      <div id="inr-input">
        <Label htmlFor="inr">INR</Label>
        <Input
          onChange={(e) => updateName(e.target.value)}
          id="inr"
          placeholder="INR"
        />
      </div>
      {/* Creatinin */}
      <div id="crea-input">
        <Label htmlFor="inr">Kreatinin [mg/dL]</Label>
        <Input
          onChange={(e) => updateName(e.target.value)}
          id="crea"
          placeholder="Kreatinin"
        />
      </div>
      {/* Albumin g/dL */}
      <div id="crea-input">
        <Label htmlFor="albumin">Albumin [g/dL]</Label>
        <Input
          onChange={(e) => updateName(e.target.value)}
          id="albumin"
          placeholder="Albumin"
        />
      </div>
    </>
  );
}
