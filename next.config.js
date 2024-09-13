/** @type {import('next').NextConfig} */

const withMarkdoc = require("@markdoc/next.js");

module.exports = withMarkdoc()({
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
});

const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
