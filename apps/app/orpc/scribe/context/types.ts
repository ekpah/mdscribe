import type { Session } from "@/lib/auth-types";

export interface ContextBuildInput {
	sources: ContextSource[];
	sessionUser?: Session["user"] | null;
}

export interface ContextBlock {
	tag: string;
	content: string;
}

export interface ContextProvider {
	id: string;
	build: (
		input: ContextBuildInput,
	) => ContextBlock | null | Promise<ContextBlock | null>;
}

export interface ContextSectionSpec {
	tag: string;
	purpose: string;
	usage: string;
	getContent: (input: PatientContextData) => string;
}

export interface PatientContextData {
	diagnoseblock: string;
	anamnese: string;
	befunde: string;
	notes: string;
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
