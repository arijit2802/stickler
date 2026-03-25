/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pino",
      "pino-pretty",
      "@opentelemetry/sdk-node",
      "@opentelemetry/auto-instrumentations-node",
    ],
    instrumentationHook: true,
  },
};

export default nextConfig;
