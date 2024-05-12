import { Tag } from "@markdoc/markdoc";
import Case from "./Case";
import Info from "./Info";
import Switch from "./Switch";

export default {
  info: {
    render: Info,
    attributes: {
      primary: {
        type: String,
      },
    },
    selfClosing: true,
  },
  switch: {
    render: Switch,
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
  case: {
    render: Case,
    attributes: { primary: { render: true, type: String } },
  },
};
