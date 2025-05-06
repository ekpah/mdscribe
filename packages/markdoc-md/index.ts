export { DynamicMarkdocRenderer } from './render/components/DynamicMarkdocRenderer';
export { useVariables, VariableProvider } from './render/context/VariableContext';

// Optionally, you could also export the lower-level functions if needed elsewhere
// export { parseMarkdoc, renderMarkdocNode } from './renderNote';

// You might also want to export your tag components or schemas if they
// need to be imported directly by consuming applications.
// export * from './markdoc-config/tags'; 