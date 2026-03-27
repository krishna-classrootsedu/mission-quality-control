// Prevent Netlify Durable Cache from caching this dynamic route's HTML shell.
// netlify.toml [[headers]] do NOT apply to function-rendered pages — only
// next.config.mjs headers() and route segment config reach the CDN.
// See: https://docs.netlify.com/manage/routing/headers/
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ModuleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
