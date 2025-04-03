import { useAtom } from 'jotai';
import { useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { formAtom } from '../../templates/[id]/_components/ContentSection';

interface FormData {
  vordiagnosen: string;
  anamnese: string;
}

export function useAnamneseForm() {
  const [formData, setFormData] = useState<FormData>({
    vordiagnosen: '',
    anamnese: '',
  });
  const [inputsData, setInputsData] = useAtom(formAtom);

  const handleFormChange = (data: FieldValues) => {
    setInputsData(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return {
    formData,
    handleFormChange,
    handleInputChange,
  };
}
