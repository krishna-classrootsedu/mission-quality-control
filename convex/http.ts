import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

const http = httpRouter();

function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.AGENT_API_KEY;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonResponse({ success: false, error: message }, 400);
}

// ---------------------------------------------------------------------------
// PUSH endpoints (POST) — agents write data
// ---------------------------------------------------------------------------

http.route({
  path: "/push/module",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.modules.upsert, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/intake",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.intake.push, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/gatekeeper",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.gatekeeper.push, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/review-scores",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.reviewScores.push, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/recommendations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.recommendations.pushBatch, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/flow-map",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.flowMap.push, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/token-usage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      // Support both single record and batch
      if (body.records) {
        const result = await ctx.runMutation(internal.tokenUsage.pushBatch, body);
        return jsonResponse({ success: true, ...result });
      } else {
        const result = await ctx.runMutation(internal.tokenUsage.push, body);
        return jsonResponse({ success: true, ...result });
      }
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/push/activity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.agentActivity.ingest, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

// ---------------------------------------------------------------------------
// UPDATE endpoints (POST) — agents/UI update existing data
// ---------------------------------------------------------------------------

http.route({
  path: "/update/module-status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      await ctx.runMutation(internal.modules.updateStatus, body);
      return jsonResponse({ success: true });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/update/recommendation-review",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      await ctx.runMutation(api.recommendations.review, body);
      return jsonResponse({ success: true });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/update/complete-recommendation-review",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.recommendations.completeVinayReview, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/update/flow-map-flag",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      await ctx.runMutation(api.flowMap.flag, body);
      return jsonResponse({ success: true });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

// ---------------------------------------------------------------------------
// QUERY endpoints (GET) — agents/UI read data
// ---------------------------------------------------------------------------

http.route({
  path: "/query/modules",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") ?? undefined;
      const modules = await ctx.runQuery(api.modules.list, { status });
      return jsonResponse(modules);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/module-detail",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get("moduleId");
      if (!moduleId) return jsonResponse({ error: "Missing moduleId" }, 400);
      const module = await ctx.runQuery(api.modules.detail, { moduleId });
      return jsonResponse(module);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/parsed-slides",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get("moduleId");
      const versionParam = url.searchParams.get("version");
      if (!moduleId) return jsonResponse({ error: "Missing moduleId" }, 400);
      const version = versionParam ? parseInt(versionParam, 10) : undefined;
      const slides = await ctx.runQuery(api.parsedSlides.byModule, { moduleId, version });
      return jsonResponse(slides);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/review-scores",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get("moduleId");
      const versionParam = url.searchParams.get("version");
      if (!moduleId) return jsonResponse({ error: "Missing moduleId" }, 400);
      const version = versionParam ? parseInt(versionParam, 10) : undefined;
      const scores = await ctx.runQuery(api.reviewScores.byModule, { moduleId, version });
      return jsonResponse(scores);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/recommendations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get("moduleId");
      const versionParam = url.searchParams.get("version");
      if (!moduleId) return jsonResponse({ error: "Missing moduleId" }, 400);
      const version = versionParam ? parseInt(versionParam, 10) : undefined;
      const recs = await ctx.runQuery(api.recommendations.byModule, { moduleId, version });
      return jsonResponse(recs);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/flow-map",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get("moduleId");
      const versionParam = url.searchParams.get("version");
      if (!moduleId) return jsonResponse({ error: "Missing moduleId" }, 400);
      const version = versionParam ? parseInt(versionParam, 10) : undefined;
      const flowMap = await ctx.runQuery(api.flowMap.byModule, { moduleId, version });
      return jsonResponse(flowMap);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/pipeline-summary",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const summary = await ctx.runQuery(api.modules.pipelineSummary, {});
      return jsonResponse(summary);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/query/activity",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const url = new URL(request.url);
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      const activity = await ctx.runQuery(api.agentActivity.recent, { limit });
      return jsonResponse(activity);
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/update/finalize-review",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.modules.finalizeReview, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

// ---------------------------------------------------------------------------
// UPLOAD endpoints — thumbnail file storage
// ---------------------------------------------------------------------------

http.route({
  path: "/upload/generate-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return jsonResponse({ uploadUrl });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

http.route({
  path: "/update/slide-thumbnail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateAuth(request)) return jsonResponse({ error: "Unauthorized" }, 401);
    try {
      const body = await request.json();
      const result = await ctx.runMutation(internal.parsedSlides.updateThumbnail, body);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return errorResponse(error);
    }
  }),
});

// ---------------------------------------------------------------------------
// CORS preflight for all routes
// ---------------------------------------------------------------------------

const allPaths = [
  "/push/module", "/push/intake", "/push/gatekeeper", "/push/review-scores",
  "/push/recommendations", "/push/flow-map", "/push/token-usage", "/push/activity",
  "/upload/generate-url",
  "/update/module-status", "/update/recommendation-review",
  "/update/complete-recommendation-review", "/update/flow-map-flag",
  "/update/slide-thumbnail", "/update/finalize-review",
  "/query/modules", "/query/module-detail", "/query/parsed-slides",
  "/query/review-scores", "/query/recommendations", "/query/flow-map",
  "/query/pipeline-summary", "/query/activity",
];

for (const path of allPaths) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }),
  });
}

export default http;
