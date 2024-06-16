import { Tag } from "@markdoc/markdoc";
import { Case } from "./Case";
import { Info } from "./Info";
import { Switch } from "./Switch";

console.log(Case);

export default {
  Info: {
    render: "Info",
    attributes: {
      primary: {
        type: String,
      },
    },
    selfClosing: true,
  },
  Switch: {
    render: "Switch",
    children: ["paragraph"],
    attributes: { primary: { render: true }, variable: { type: String } },
    transform(node, config) {
      const cases = node
        .transformChildren(config)
        .filter((child) => child.type === "tag" && child.tag === "case")
        .map((tab) =>
          typeof tab === "object" ? tab.attributes.primary : null
        );
      const variable = node.attributes.primary;
      return new Tag(
        this.render,
        { variable, cases },
        node.transformChildren(config)
      );
    },
  },
  Case: {
    render: "Case",
    attributes: { primary: { render: true, type: String } },
  },
};

export const components = {
  Case,
  Info,
  Switch,
};
