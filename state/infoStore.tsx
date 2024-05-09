import { create } from "zustand";

export type InfoState = {
  name: string;
  gender: string;
};

export type InfoActions = {
  setGenderMale: () => void;
  setGenderFemale: () => void;
  updateName: (name: string) => void;
};

export type InfoStore = InfoState & InfoActions;
export const defaultInitState: InfoState = {
  name: "[#NAME#] ",
  gender: "undefined",
};

export const createInfoStore = (initState: InfoState = defaultInitState) => {
  return create<InfoStore>()((set) => ({
    ...initState,
    setGenderMale: () => set(() => ({ gender: "male" })),
    setGenderFemale: () => set(() => ({ gender: "female" })),
    updateName: (name) => set(() => ({ name: name })),
  }));
};
