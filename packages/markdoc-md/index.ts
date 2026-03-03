export { default as parseMarkdocToInputs } from './parse/parse-markdoc-to-inputs';
export { DynamicMarkdocRenderer } from './render/components/dynamic-markdoc-renderer';
export {
  useVariables,
  VariableProvider,
} from './render/context/variable-context';

// Optionally, you could also export the lower-level functions if needed elsewhere
// export { parseMarkdoc, renderMarkdocNode } from './renderNote';

// You might also want to export your tag components or schemas if they
// need to be imported directly by consuming applications.
// export * from './markdoc-config/tags';
