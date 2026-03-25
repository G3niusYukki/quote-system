import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "bcryptjs",
    "jsonwebtoken",
    "@prisma/client",
    "prisma",
  ],
};

export default nextConfig;
