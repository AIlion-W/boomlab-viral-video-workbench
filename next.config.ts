import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vinext applies the Server Actions body cap to App Router requests too.
    // Leave room for multipart framing while the application enforces 15MB.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
