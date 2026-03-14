"use client";

import {
	buildBuiltInAiscribeTemplateConfig,
	type BuiltInAiscribeTemplateKey,
} from "../_lib/built-in-form-config";
import {
	buildCustomAiscribeTemplateConfig,
	type PublicAiTextForm,
} from "../_lib/custom-form-config";
import { AiscribeTemplate } from "./aiscribe-template";

type CustomAiscribeClientProps =
	| {
			form: PublicAiTextForm;
			mode: "custom";
	  }
	| {
			mode: "built-in";
			overrideForm?: PublicAiTextForm | null;
			template: BuiltInAiscribeTemplateKey;
	  };

export function CustomAiscribeClient(props: CustomAiscribeClientProps) {
	const config =
		props.mode === "custom"
			? buildCustomAiscribeTemplateConfig(props.form)
			: buildBuiltInAiscribeTemplateConfig({
					overrideForm: props.overrideForm,
					template: props.template,
				});

	return <AiscribeTemplate config={config} />;
}
