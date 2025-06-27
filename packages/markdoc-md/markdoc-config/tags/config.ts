import { type Config, type Node, Tag } from '@markdoc/markdoc';
import { Case } from './Case';
import { Info } from './Info';
import { Score } from './Score';
import { Switch } from './Switch';

export default {
  info: {
    render: 'Info',
    attributes: {
      primary: {
        type: String,
      },
      type: {
        type: String,
        default: 'string',
        matches: ['string', 'number', 'boolean'],
      },
      unit: {
        type: String,
        required: false,
      },
    },
    selfClosing: true,
  },
  score: {
    render: 'Score',
    attributes: {
      formula: { type: String, required: true },
      unit: { type: String },
    },
  },
  switch: {
    render: 'Switch',
    children: ['tag', 'text'],
    attributes: { primary: { type: String } },
    selfClosing: false,
    // this transform is necessary to only allow case tags inside switch tags to render
    // switch tags should not contain breaks, as this will not be rendered correctly (markdoc only recognizes inline tags or full paragraphs)
    transform(node: Node, config: Config) {
      const getAllCaseTags = (nodes: Node[]): Node[] => {
        return nodes.reduce((acc: Node[], node) => {
          if (node.type === 'tag' && node.tag === 'case') {
            acc.push(node);
          }
          if (node.children) {
            acc.push(...getAllCaseTags(node.children));
          }
          return acc;
        }, []);
      };
      node.children = getAllCaseTags(node.children);
      const attributes = node.transformAttributes(config);
      const children = node.transformChildren(config);

      return new Tag('Switch', attributes, children);
    },
  },
  // cases should not contain breaks, as this will not be rendered correctly
  case: {
    render: 'Case',
    children: ['text', 'strong', 'em', 'code', 'link', 'inline'],
    attributes: { primary: { render: true, type: String } },
  },
};

export const components: Record<string, React.ComponentType<any>> = {
  Case: Case,
  Info: Info,
  Switch: Switch,
  Score: Score,
};
