/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  generateBuildId: async () => {
    return process.env.COMMIT_REF ?? `local-${Date.now()}`;
  },
  // Cache-control headers set HERE reach the CDN from inside the function response.
  // netlify.toml [[headers]] do NOT apply to serverless function routes (dynamic pages).
  // See: https://docs.netlify.com/manage/routing/headers/
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Netlify-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
