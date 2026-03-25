import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "bcryptjs",
    "jsonwebtoken",
    "@prisma/client",
    "prisma",
  ],
};

export default nextConfig;
