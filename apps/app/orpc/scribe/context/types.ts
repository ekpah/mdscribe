import type { Session } from "@/lib/auth-types";

export interface PatientContextData {
	diagnoseblock: string;
	anamnese: string;
	befunde: string;
	notes: string;
}

export interface TemplateContextInput extends Record<string, unknown> {
	content: string;
	examples: string[];
	title: string;
}

export type ContextSource =
	| {
			kind: "form";
			data: Record<string, unknown>;
	  }
	| {
			kind: "template";
			data: Record<string, unknown>;
	  }
	| {
			kind: "fhir";
			data: unknown;
	  }
	| {
			kind: "hl7";
			data: unknown;
	  };

export interface ContextBuildInput {
	sources: ContextSource[];
	sessionUser?: Session["user"] | null;
}

export interface ComposeScribeContextInput {
	formData: Record<string, unknown>;
	sessionUser?: Session["user"] | null;
	template?: TemplateContextInput | null;
}

export interface ComposedScribeContext {
	contextXml: string;
	patientContext: PatientContextData;
	sources: ContextSource[];
}
