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
};

export default nextConfig;
