import Markdoc from '@markdoc/markdoc';

import type { Node } from '@markdoc/markdoc';

function processSwitchStatement(
  node: Node,
  result = { variable: '', options: [] as string[] }
) {
  // If the node has children, process them recursively

  if (node.tag === 'switch') {
    result.variable = node.attributes.primary;
  } else if (node.tag === 'case') {
    result.options.push(node.attributes.primary);
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.tag !== 'switch') {
        processSwitchStatement(child, result);
      }
    }
  }

  return result;
}

function processSwitchChildren(
  node: Node,
  result: CaseTagType[] = []
): CaseTagType[] {
  // If the node has children, process them recursively
  if (node.tag === 'case') {
    result.push({
      type: 'case',
      options: { name: node.attributes.primary },
    });
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.tag !== 'switch') {
        processSwitchChildren(child, result);
      }
    }
  }

  return result;
}

type InputTagType = {
  type: 'info' | 'switch';
  options: { name: string };
  children?: CaseTagType[];
};

type InfoTagType = {
  type: 'info';
  options: { name: string };
};

type SwitchTagType = {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

type CaseTagType = {
  type: 'case';
  options: { name: string };
};

const parseTagsToInputs = ({ ast }: { ast: Node }) => {
  // all tags in the order they appear in the document
  const inputTags: InputTagType[] = [];
  // all info tags (remove duplicates)
  const infoTags: string[] = [];
  // all switch tags (remove duplicates)
  const switchTags: { variable: string; options: string[] }[] = [];
  for (const node of ast.walk()) {
    // do something with each node
    // get all info tags (remove duplicates)
    if (
      node.type === 'tag' &&
      node.tag === 'info' &&
      !infoTags.includes(node.attributes.primary)
    ) {
      inputTags.push({
        type: 'info',
        options: { name: node.attributes.primary },
      });
      infoTags.push(node.attributes.primary);
    }
    // get all switch tags, if unique
    if (
      node.type === 'tag' &&
      node.tag === 'switch' &&
      !switchTags.some((tag) => tag.variable === node.attributes.primary) &&
      node.attributes.primary
    ) {
      inputTags.push({
        type: 'switch',
        options: { name: node.attributes.primary },
        children: processSwitchChildren(node),
      });
      switchTags.push(processSwitchStatement(node));
    }
  }

  // parse all switch tags
  return { infoTags, switchTags, inputTags };
};

// function to take markdoc content and return parsed tags
export default function parseMarkdocToInputs(content: string) {
  const ast = Markdoc.parse(content);
  return parseTagsToInputs({ ast });
}
