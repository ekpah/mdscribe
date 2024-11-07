/** @type {import('next').NextConfig} */

const withMarkdoc = require("@markdoc/next.js");

module.exports = withMarkdoc()({
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
});

const nextConfig = {
  reactStrictMode: true,
};

const withVercelToolbar = require("@vercel/toolbar/plugins/next")();
// Instead of module.exports = nextConfig, do this:
module.exports = withVercelToolbar(nextConfig);

module.exports = nextConfig;
