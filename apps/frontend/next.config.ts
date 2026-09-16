import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desktop fork (#15): keep Prisma runtime + engine loader out of the server
  // bundle. External = node_modules present at runtime, the correct shape for
  // a desktop app with an embedded server (validated in the #5 probe).
  serverExternalPackages: ["@repo/db", "@prisma/client", "@prisma/engines"],
  // #15: production webpack of this app exceeds Node's default heap — the
  // build wrapper raises it to 12 GB. webpackMemoryOptimizations was tried
  // and made the OOM come FASTER (26 min vs 37) — reverted.
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
  // Production webpack (packaged desktop build). Note: PrismaPlugin is
  // deliberately NOT restored — it crashed with Next 15.3 (#6/#7 memo) and
  // is unnecessary for the desktop: node_modules ship with the packaged app.
  ...(process.env.NODE_ENV === "production"
    ? {
        webpack: (config: {
          module: { rules: Record<string, unknown>[] };
          plugins: unknown[];
        }) => {
          // #15 OOM mitigation (attempts 1-3 died at 4/8/12 GB): disable
          // module concatenation (webpack 5's biggest consumer on huge
          // module graphs) and production source maps.
          config.devtool = false;
          if (config.optimization) config.optimization.concatenateModules = false;

          // Grab the existing rule that handles SVG imports
          const fileLoaderRule = config.module.rules.find(
            (rule: { test?: { test?: (arg0: string) => boolean } }) =>
              rule.test?.test?.(".svg")
          );

          config.module.rules.push(
            // Reapply the existing rule, but only for svg imports ending in ?url
            {
              ...(fileLoaderRule ?? {}),
              test: /\.svg$/i,
              resourceQuery: /url/, // *.svg?url
            },
            // Convert all other *.svg imports to React components
            {
              test: /\.svg$/i,
              issuer: fileLoaderRule?.issuer,
              resourceQuery: {
                not: [...(fileLoaderRule?.resourceQuery?.not ?? []), /url/],
              }, // exclude if *.svg?url
              use: ["@svgr/webpack"],
            }
          );

          // Modify the file loader rule to ignore *.svg, since we have it handled now.
          if (fileLoaderRule) fileLoaderRule.exclude = /\.svg$/i;

          return config;
        },
      }
    : {}),

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
