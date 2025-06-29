import type { RenderableTreeNode } from '@markdoc/markdoc';
import Markdoc from '@markdoc/markdoc';
import { default as Formula, default as fparser } from 'fparser';
import config from '../markdoc-config';

/**
 * Union type representing all possible input tag types in the Markdoc template.
 * Extends RenderableTreeNode to include Markdoc's base node properties.
 */
export type InputTagType = RenderableTreeNode &
  (
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
    type?: 'string' | 'number' | 'date';
    unit?: string;
  };
  children: InputTagType[];
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

// Constants for better performance
const VALID_TAG_NAMES = new Set(['Info', 'Case', 'Switch', 'Score']);

const parseTagsToInputs = ({ nodes }: { nodes: RenderableTreeNode }) => {
  const inputTags: InputTagType[] = [];
  const uniqueTags = new Set<string>();

  // Optimized children processing function
  const processChildrenOptimized = (
    children: any,
    childContext: any
  ): InputTagType[] => {
    if (!children) return [];

    const childrenArray = Array.isArray(children) ? children : [children];
    const result: InputTagType[] = [];

    // Use for loop for better performance than forEach/map
    for (let i = 0; i < childrenArray.length; i++) {
      result.push(...processNode(childrenArray[i], childContext));
    }

    return result;
  };

  // Optimized main processing function
  function processNode(
    node: RenderableTreeNode,
    parentContext?: { type: string; path: string }
  ): InputTagType[] {
    // Early returns for invalid nodes
    if (!node || typeof node !== 'object') return [];

    const currentLevelTags: InputTagType[] = [];

    // Check if it's a valid tag node
    if (
      '$$mdtype' in node &&
      node.$$mdtype === 'Tag' &&
      'name' in node &&
      VALID_TAG_NAMES.has(node.name as string)
    ) {
      const componentNode = node as any;
      const tagKey = componentNode.attributes.primary;

      // Process each tag type with optimized logic
      if (componentNode.name === 'Info' && !uniqueTags.has(tagKey)) {
        const infoTag = {
          name: 'Info' as const,
          attributes: componentNode.attributes,
          children: processChildrenOptimized(componentNode.children, {
            type: 'Info',
            path: tagKey,
          }),
        } as InfoInputTagType;

        currentLevelTags.push(infoTag);
        uniqueTags.add(tagKey);
      } else if (
        componentNode.name === 'Switch' &&
        !uniqueTags.has(tagKey) &&
        componentNode.attributes.primary
      ) {
        const switchTag = {
          name: 'Switch' as const,
          attributes: { primary: componentNode.attributes.primary },
          children: processChildrenOptimized(componentNode.children, {
            type: 'Switch',
            path: tagKey,
          }),
        } as SwitchInputTagType;

        currentLevelTags.push(switchTag);
        uniqueTags.add(tagKey);
      } else if (componentNode.name === 'Case' && !uniqueTags.has(tagKey)) {
        const caseTag = {
          name: 'Case' as const,
          attributes: { primary: componentNode.attributes.primary || '' },
          children: processChildrenOptimized(componentNode.children, {
            type: 'Case',
            path: tagKey,
          }),
        } as CaseInputTagType;

        currentLevelTags.push(caseTag);
        uniqueTags.add(tagKey);
      } else if (componentNode.name === 'Score' && !uniqueTags.has(tagKey)) {
        const scoreTag = {
          name: 'Score' as const,
          attributes: componentNode.attributes,
          children: processChildrenOptimized(componentNode.children, {
            type: 'Score',
            path: tagKey,
          }),
        } as ScoreInputTagType;

        try {
          const formula = new Formula(componentNode.attributes.formula);
          const variables = formula.getVariables();

          for (const variable of variables) {
            scoreTag.children.push({
              name: 'Info' as const,
              attributes: {
                primary: variable,
                type: 'number',
              },
            } as InfoInputTagType);
          }
        } catch (error) {
          console.error('Error parsing formula', error);
        }

        currentLevelTags.push(scoreTag);
        uniqueTags.add(tagKey);
      }
    }
    // Process children for non-tag nodes more efficiently
    else if (
      'children' in node &&
      !('name' in node && VALID_TAG_NAMES.has(node.name as string))
    ) {
      currentLevelTags.push(
        ...processChildrenOptimized(node.children, parentContext)
      );
    }

    return currentLevelTags;
  }

  // Start processing from the root
  inputTags.push(...processNode(nodes));

  return inputTags;
};

// function to take markdoc content and return parsed tags
export default function parseMarkdocToInputs(content: string): InputTagType[] {
  const ast = Markdoc.parse(content);
  const nodes = Markdoc.transform(ast, config);
  return parseTagsToInputs({ nodes });
}
