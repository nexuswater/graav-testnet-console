import type { NextConfig } from "next";
import path from "path";

const stub = path.join(__dirname, "src/lib/empty-module.js");

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/evm": stub,
      "@x402/evm/upto/client": stub,
      "@x402/evm/exact/client": stub,
      "@x402/core/client": stub,
      "@x402/svm/exact/client": stub,
      "@x402/svm": stub,
      "@x402/core": stub,
    };
    return config;
  },
};

export default nextConfig;
