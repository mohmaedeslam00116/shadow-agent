import type { NextConfig } from "next";
// PROBE: PrismaPlugin disabled on research/electron-probe — it throws
// "Cannot read properties of undefined (reading 'server')" with Next 15.3
// webpack (incompatibility) and globs into Windows profile junctions (EPERM).
// See docs/research/005-electron-probe-results.md. NEVER MERGE AS-IS.
// import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // PROBE: keep Prisma runtime + engine loader out of the server bundle.
  // Turbopack bundling mangles the engine path discovery (numeric module id
  // passed to path.join). External = node_modules present at runtime, which
  // is the correct shape for a desktop app with an embedded server.
  serverExternalPackages: ["@repo/db", "@prisma/client", "@prisma/engines"],
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  turbopack: {
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              icon: true,
            },
          },
        ],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
