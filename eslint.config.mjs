import nextConfig from "eslint-config-next/core-web-vitals";

const config = Array.isArray(nextConfig) ? nextConfig : [nextConfig];

export default config;
