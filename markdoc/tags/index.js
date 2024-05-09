import { Tag } from "@markdoc/markdoc";
import Info from "./Info";
import Switch from "./Switch";

export default {
  info: {
    render: Info,
    attributes: {
      variable: {
        type: String,
      },
    },
    selfClosing: true,
  },
  switch: {
    render: Switch,
    attributes: { variable: { type: String } },
    transform(node, config) {
      // console.log("Node: ", node.children);
      // console.log("Config: ", config);
      // console.log(node.transformChildren(config));
      const attributes = node.transformAttributes(config);
      // console.log(attributes);
      const children = node
        .transformChildren(config)
        .filter((child) => child.type === "tag" && child.tag === "case");
      // .map((e) => [e.attributes, e]);
      // console.log(children);
      return new Tag(
        this.render,
        { attributes, children },
        node.transformChildren(config)
      );
    },
  },
  case: {
    render: "Case",
    attributes: { primary: { type: String } },
  },
};
