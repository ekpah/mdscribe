// Compile-only fixture for the published entry points.
import type { Config } from "@markdoc/markdoc";
import { markdocConfig, type MarkdocTemplateDiagnostic, validateMarkdocTemplate } from "markdoc-md";
import type { CitationResolverContext } from "markdoc-md/citations";
import { isHtmlToMarkdocSupported } from "markdoc-md/editor";
import parseMarkdocToInputs, { getFormulaVariables } from "markdoc-md/parse";
import type { RenderMarkdocReactOptions } from "markdoc-md/react";
import type { MarkdocSourceContexts } from "markdoc-md/sources";
import type { ReactElement } from "react";

const config: Config = { ...markdocConfig, variables: { locale: "en" } };
const diagnostics: MarkdocTemplateDiagnostic[] = validateMarkdocTemplate("hello", config);
const citationContext: CitationResolverContext = {};
const sourceContexts: MarkdocSourceContexts = { config };
const rendererOptions: RenderMarkdocReactOptions = { config };

void markdocConfig;
void isHtmlToMarkdocSupported;
void getFormulaVariables;
void parseMarkdocToInputs;

export const fixture: ReactElement = <span>{diagnostics.length}</span>;
export const typedIntegration = { citationContext, rendererOptions, sourceContexts };
