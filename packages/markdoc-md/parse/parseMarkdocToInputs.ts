import type { RenderableTreeNode } from '@markdoc/markdoc';
import Markdoc from '@markdoc/markdoc';
import Formula from 'fparser';
import config from '../markdoc-config';

type BaseTagType = {
  type: 'info' | 'switch';
};

type InfoTagType = BaseTagType & {
  type: 'info';
  options: { name: string; type?: 'string' | 'number' | 'boolean' };
};

type SwitchTagType = BaseTagType & {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

type CaseTagType = {
  type: 'case';
  options: { name: string };
};

type InputTagType = InfoTagType | SwitchTagType;

type InputComponentProps = {
  primary?: string;
  formula?: string;
  type?: 'string' | 'number' | 'boolean';
};

type InputComponentNode = {
  $$mdtype: 'Tag';
  name: string;
  attributes: InputComponentProps;
  children?: RenderableTreeNode | RenderableTreeNode[];
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
      const componentNode = node as InputComponentNode;
      const tagKey = `${componentNode.name}:${componentNode.attributes.primary || componentNode.attributes.formula}`;

      // Process info tags
      if (componentNode.name === 'Info' && !uniqueTags.has(tagKey)) {
        inputTags.push({
          type: 'info',
          options: {
            name: componentNode.attributes.primary || '',
            type: componentNode.attributes.type,
          },
        });
        uniqueTags.add(tagKey);
      }

      // Process switch tags
      if (
        componentNode.name === 'Switch' &&
        !uniqueTags.has(tagKey) &&
        componentNode.attributes.primary
      ) {
        inputTags.push({
          type: 'switch',
          options: { name: componentNode.attributes.primary },
          children: processSwitchChildrenFromRenderable(componentNode),
        });
        uniqueTags.add(tagKey);
      }

      // Process score tags
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
      }
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

  return { inputTags };
};

// Helper function to process switch children from renderable tree
function processSwitchChildrenFromRenderable(
  node: InputComponentNode
): CaseTagType[] {
  const result: CaseTagType[] = [];

  function processChild(child: RenderableTreeNode) {
    if (!child || typeof child !== 'object') return;

    if (
      '$$mdtype' in child &&
      child.$$mdtype === 'Component' &&
      child.name === 'case'
    ) {
      const caseNode = child as InputComponentNode;
      result.push({
        type: 'case',
        options: { name: caseNode.props.primary || '' },
      });
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
export default function parseMarkdocToInputs(content: string): {
  inputTags: InputTagType[];
} {
  const ast = Markdoc.parse(content);
  const nodes = Markdoc.transform(ast, config);
  return parseTagsToInputs({ nodes });
}
