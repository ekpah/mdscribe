"use client";

import { buildBuiltInAiscribeTemplateConfig } from '@/app/aiscribe/_lib/built-in-form-config';
import type { BuiltInAiscribeTemplateKey } from '@/app/aiscribe/_lib/built-in-form-config';
import { buildCustomAiscribeTemplateConfig } from '@/app/aiscribe/_lib/custom-form-config';
import type { PublicAiTextForm } from '@/app/aiscribe/_lib/custom-form-config';
import { AiscribeTemplate } from "./aiscribe-template";

type CustomAiscribeClientProps =
	| {
			form: PublicAiTextForm;
			isAdmin?: boolean;
			mode: "custom";
	  }
	| {
			isAdmin?: boolean;
			mode: "built-in";
			overrideForm?: PublicAiTextForm | null;
			template: BuiltInAiscribeTemplateKey;
	  };

export const CustomAiscribeClient = (props: CustomAiscribeClientProps) => {
	const config =
		props.mode === "custom"
			? buildCustomAiscribeTemplateConfig(props.form)
			: buildBuiltInAiscribeTemplateConfig({
					overrideForm: props.overrideForm,
					template: props.template,
				});

	return <AiscribeTemplate config={config} isAdmin={Boolean(props.isAdmin)} />;
};
