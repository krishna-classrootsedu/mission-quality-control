import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/deploy-hook
 *
 * Called by a Netlify deploy notification webhook after each successful
 * production deploy. Purges ALL Netlify Durable CDN cache for the site so
 * stale pre-rendered HTML (with old CSS/JS chunk hashes) is never served.
 *
 * Setup in Netlify dashboard:
 *   Site settings → Build & deploy → Deploy notifications
 *   → Add webhook → URL: https://mission-quality-control.netlify.app/api/deploy-hook
 *   → Event: "Deploy succeeded"
 *   → Add header: x-webhook-secret: <same value as DEPLOY_HOOK_SECRET env var>
 *
 * Environment variables (set in Netlify dashboard):
 *   NETLIFY_PURGE_API_TOKEN  — auto-set by Netlify in Functions context
 *   SITE_ID                  — auto-set by Netlify in Functions context
 *   DEPLOY_HOOK_SECRET       — optional, set to protect this endpoint
 */
export async function POST(request: NextRequest) {
  const secret = process.env.DEPLOY_HOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.NETLIFY_PURGE_API_TOKEN;
  const siteId = process.env.SITE_ID;

  if (!token || !siteId) {
    return NextResponse.json(
      { error: "Missing NETLIFY_PURGE_API_TOKEN or SITE_ID" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.netlify.com/api/v1/purge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ site_id: siteId }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  return NextResponse.json({ purged: true, timestamp: new Date().toISOString() });
}
