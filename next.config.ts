import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/api/email-cv": ["./assets/fonts/*.ttf"] },
};
export default nextConfig;
