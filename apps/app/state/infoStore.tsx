import { create } from 'zustand';

export type InfoState = {
  name: string;
  gender: string;
  meldScore: number;
};

export type InfoActions = {
  setGenderMale: () => void;
  setGenderFemale: () => void;
  updateName: (name: string) => void;
  updateMeldScore: (score: number) => void;
};

export type InfoStore = InfoState & InfoActions;
export const defaultInitState: InfoState = {
  name: '[#NAME#]',
  gender: 'undefined',
  meldScore: 0,
};

export const createInfoStore = (initState: InfoState = defaultInitState) => {
  return create<InfoStore>()((set) => ({
    ...initState,
    setGenderMale: () => set(() => ({ gender: 'male' })),
    setGenderFemale: () => set(() => ({ gender: 'female' })),
    updateName: (name) => set(() => ({ name: name })),
    updateMeldScore: (score) => set(() => ({ meldScore: score })),
  }));
};
