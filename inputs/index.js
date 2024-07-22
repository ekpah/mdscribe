"use client";
import dischargeWeight from "./dischargeWeight";
import Gender from "./Gender.tsx";
import Hb from "./Hb.tsx";
import MELD from "./MELD.tsx";
import Name from "./Name.tsx";
import Transfusion from "./transfusion";

export { default as Gender } from "./Gender";
export { default as MELD } from "./MELD";
export { default as Name } from "./Name";

export const inputComponents = {
  Gender,
  Name,
  MELD,
  Hb,
  Transfusion,
  dischargeWeight,
};
