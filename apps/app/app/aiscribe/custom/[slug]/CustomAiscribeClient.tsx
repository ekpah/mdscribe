"use client";

import { AiscribeTemplate } from "../../_components/AiscribeTemplate";
import {
	buildCustomAiscribeTemplateConfig,
	type PublicAiTextForm,
} from "../../_lib/custom-form-config";

interface CustomAiscribeClientProps {
	form: PublicAiTextForm;
}

export function CustomAiscribeClient({
	form,
}: CustomAiscribeClientProps) {
	return <AiscribeTemplate config={buildCustomAiscribeTemplateConfig(form)} />;
}
