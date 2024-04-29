export default {
  callout: {
    render: "Callout",
    attributes: {
      title: {
        type: String,
      },
    },
  },
  switch: {
    attributes: { primary: { render: false } },
    transform(node, config) {
      const attributes = node.transformAttributes(config);

      const child = node.children.find(
        (child) => child.attributes.primary === attributes.primary
      );

      return child ? transformer.node(child, config) : [];
    },
  },
  case: {
    attributes: { primary: { render: false } },
  },
};
