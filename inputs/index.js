"use client";
import Gender from "./Gender.tsx";
import MELD from "./MELD.tsx";
import Name from "./Name.tsx";

export { default as Gender } from "./Gender";
export { default as MELD } from "./MELD";
export { default as Name } from "./Name";

export const inputComponents = {
  Gender,
  Name,
  MELD,
};
