import type { RenderableTreeNode } from '@markdoc/markdoc';
import Markdoc from '@markdoc/markdoc';
import config from '../markdoc-config';

/** 
 * Union type representing all possible input tag types in the Markdoc template.
 * Extends RenderableTreeNode to include Markdoc's base node properties.
 */
export type InputTagType = RenderableTreeNode & (
  | InfoInputTagType 
  | SwitchInputTagType
  | CaseInputTagType
  | ScoreInputTagType
);

/**
 * Represents an info tag that captures single values.
 * @example
 * {% info "patient_name" /%}
 * @property {string} attributes.primary - The identifier for the info tag
 * @property {('string'|'number')} [attributes.type] - The data type of the value
 * @property {string} [attributes.unit] - Optional unit for numeric values
 */
export type InfoInputTagType = RenderableTreeNode & {
  name: 'Info';
  attributes: {
    primary: string;
    type?: 'string' | 'number';
    unit?: string;
  };
  children?: InputTagType[];
};

/**
 * Represents a switch tag for conditional content rendering.
 * Contains case tags as children for different conditions.
 * @example
 * {% switch "gender" %}
 *   {% case "male" %}Male{% /case %}
 * {% /switch %}
 */
export type SwitchInputTagType = RenderableTreeNode & {
  name: 'Switch';
  attributes: {
    primary: string;
  };
  children: InputTagType[];
};

/**
 * Represents a case tag used within switch tags.
 * Defines a specific condition and its content.
 * @example
 * {% case "male" %}Male{% /case %}
 */
export type CaseInputTagType = RenderableTreeNode & {
  name: 'Case';
  attributes: {
    primary: string;
  };
  children: InputTagType[];
};

/**
 * Represents a score tag for calculating values based on a formula.
 * @example
 * {% score formula="[age]*2+[gender_score]*3" unit="points" /%}
 */
export type ScoreInputTagType = RenderableTreeNode & {
  name: 'Score';
  attributes: {
    primary: string;
    formula?: string;
    unit?: string;
  };
  children: InputTagType[];
};

const parseTagsToInputs = ({ nodes }: { nodes: RenderableTreeNode }) => {
  // all tags in the order they appear in the document
  const inputTags: InputTagType[] = [];
  // Track unique tags by name and type
  const uniqueTags = new Set<string>();

  // Helper function to recursively process nodes
  function processNode(node: RenderableTreeNode) {
    if (!node || typeof node !== 'object') {
      return;
    }
    // Process the current node if it's a component
    if ('$$mdtype' in node && node.$$mdtype === 'Tag') {
      const componentNode = node as InputTagType;
      const tagKey = `${componentNode.name}:${componentNode.attributes.primary}`;

      // Process info tags
      if (componentNode.name === 'Info' && !uniqueTags.has(tagKey)) {
        inputTags.push({
          name: 'Info',
          attributes: componentNode.attributes,
        } as InfoInputTagType);
        uniqueTags.add(tagKey);
      }

      // Process switch tags
      if (
        componentNode.name === 'Switch' &&
        !uniqueTags.has(tagKey) &&
        componentNode.attributes.primary
      ) {
        inputTags.push({
          name: 'Switch',
          attributes: { primary: componentNode.attributes.primary },
          children: processSwitchChildrenFromRenderable(componentNode),
        } as SwitchInputTagType);
        uniqueTags.add(tagKey);
      }

      // Process score tags
      /* Skip this for now - Score tags can only use variables from already defined tags
      if (componentNode.name === 'Score' && componentNode.attributes.formula) {
        if (!uniqueTags.has(tagKey)) {
          uniqueTags.add(tagKey);
        }

        // Extract variables from formula using fparser
        try {
          const formula = new Formula(componentNode.attributes.formula);
          const variables = formula.getVariables();
          for (const variable of variables) {
            const varKey = `info:${variable}`;
            if (!uniqueTags.has(varKey)) {
              inputTags.push({
                type: 'info',
                options: { name: variable, type: 'number' },
              });
              uniqueTags.add(varKey);
            }
          }
        } catch (error) {
          // If formula parsing fails, skip adding variables
          console.warn(
            `Failed to parse formula: ${componentNode.attributes.formula} with error: ${error}`
          );
        }
        
      }*/
    }

    // Process children recursively
    if ('children' in node) {
      const children = node.children;
      if (Array.isArray(children)) {
        children.forEach(processNode);
      } else if (children) {
        processNode(children);
      }
    }
  }

  // Start processing from the root
  processNode(nodes);

  return inputTags;
};

// Helper function to process switch children from renderable tree
function processSwitchChildrenFromRenderable(
  node: InputTagType
): InputTagType[] {
  const result: InputTagType[] = [];

  function processChild(child: RenderableTreeNode) {
    if (!child || typeof child !== 'object') return;

    if (
      '$$mdtype' in child &&
      child.$$mdtype === 'Tag' &&
      child.name === 'Case'
    ) {
      const caseNode = child as InputTagType;
      result.push({
        name: 'Case',
        attributes: { primary: caseNode.attributes.primary || '' },
        children: processSwitchChildrenFromRenderable(caseNode),
      } as CaseInputTagType);
    }

    if ('children' in child) {
      const children = child.children;
      if (Array.isArray(children)) {
        children.forEach(processChild);
      } else if (children) {
        processChild(children);
      }
    }
  }

  if (node.children) {
    if (Array.isArray(node.children)) {
      node.children.forEach(processChild);
    } else {
      processChild(node.children);
    }
  }

  return result;
}

// function to take markdoc content and return parsed tags
export default function parseMarkdocToInputs(content: string): InputTagType[] {
  const ast = Markdoc.parse(content);
  const nodes = Markdoc.transform(ast, config);
  return parseTagsToInputs({ nodes });
}
