import { Tag } from '@markdoc/markdoc';
import { Case } from './Case';
import { Info } from './Info';
import { Switch } from './Switch';

export default {
  info: {
    render: 'Info',
    attributes: {
      primary: {
        type: String,
      },
    },
    selfClosing: true,
  },
  switch: {
    render: 'Switch',
    children: ['tag', 'softbreak'],
    attributes: { primary: { type: String } },
    transform(node: any, config: any) {
      const cases = node
        .transformChildren(config)
        .filter((child: any) => child.type === 'tag' && child.tag === 'case')
        .map((tab: any) =>
          typeof tab === 'object' ? tab.attributes.primary : null
        );
      const primary = node.attributes.primary;
      return new Tag(
        this.render,
        { primary, cases },
        node.transformChildren(config)
      );
    },
  },
  case: {
    render: 'Case',
    attributes: { primary: { render: true, type: String } },
  },
};

export const components: Record<string, React.ComponentType<any>> = {
  Case: Case,
  Info: Info,
  Switch: Switch,
};
