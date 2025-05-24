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
    attributes: {
      primary: { type: String },
    },
    transform(node, config) {
      const cases = node
        .transformChildren(config)
        .filter((child) => child.$$mdtype === 'Tag' && child.name === 'Case');

      // console.log('cases:', cases);
      const variable = node.attributes.primary;

      return new Tag(
        this.render,
        { variable, cases },
        node.transformChildren(config)
      );
    },
  },
  case: {
    render: 'Case',
    attributes: {
      primary: {
        type: String,
        required: false,
      },
    },
  },
};

export const components = {
  Case: Case,
  Info: Info,
  Switch: Switch,
};
