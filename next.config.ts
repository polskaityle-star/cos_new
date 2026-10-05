import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "*.lhr.life",
    "*.loca.lt",
  ],
};

export default nextConfig;
