import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per module submission
  modules: defineTable({
    moduleId: v.string(),
    title: v.string(),
    learningObjective: v.string(),
    grade: v.number(),
    chapterNumber: v.optional(v.number()),
    chapterName: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
    cp: v.optional(v.string()),
    tp: v.optional(v.string()),
    phase: v.optional(v.string()),
    topic: v.optional(v.string()),
    pptxFileUrl: v.optional(v.string()),
    slideCount: v.optional(v.number()),
    status: v.string(),
    version: v.number(),
    // Denormalized score data (set by Integrator)
    overallScore: v.optional(v.number()),
    overallPercentage: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    // Research brief (set by Researcher agent after Flow Mapper)
    researchBrief: v.optional(v.string()),
    // Spine/applet completion tracking
    spineComplete: v.optional(v.boolean()),
    totalApplets: v.optional(v.number()),
    completedAppletReviews: v.optional(v.number()),
    sourceFiles: v.optional(v.array(v.object({
      filename: v.string(),
      type: v.string(),
      label: v.string(),
      afterSpineSlide: v.optional(v.number()),
      slideCount: v.number(),
      storageId: v.optional(v.id("_storage")),
    }))),
    // Soft-delete (agents check this before pushing data)
    deleted: v.optional(v.boolean()),
    // Metadata
    submittedBy: v.optional(v.string()),
    submittedAt: v.string(),
    updatedAt: v.string(),
    completedAt: v.optional(v.string()),
  })
    .index("by_moduleId", ["moduleId"])
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"]),

  // Reader output — one per module+version
  intakeResults: defineTable({
    moduleId: v.string(),
    version: v.number(),
    slideCount: v.number(),
    slideTypes: v.any(),
    detectedLO: v.optional(v.string()),
    flags: v.array(
      v.object({
        type: v.string(),
        description: v.string(),
        slideNumbers: v.optional(v.array(v.number())),
      })
    ),
    agentName: v.string(),
    completedAt: v.string(),
    dedupKey: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_dedupKey", ["dedupKey"]),

  // Individual slide records (~90 per module)
  parsedSlides: defineTable({
    moduleId: v.string(),
    version: v.number(),
    slideNumber: v.number(),
    slideType: v.optional(v.string()),
    textContent: v.optional(v.string()),
    speakerNotes: v.optional(v.string()),
    layoutType: v.optional(v.string()),
    hasAnimation: v.optional(v.boolean()),
    animationSequence: v.optional(v.any()),
    thumbnailStorageId: v.optional(v.id("_storage")),
    sourceFile: v.optional(v.string()), // "spine" | "A1" | "A2" etc
    sourceSlideNumber: v.optional(v.number()), // original number in source PPTX
    morphPairWith: v.optional(v.number()), // slide number of morph partner
    metadata: v.optional(v.any()),
    agentName: v.string(),
    createdAt: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_slide", ["moduleId", "version", "slideNumber"]),

  // Binary rule check — one row per component (module, applet_1, applet_2, etc.)
  gatekeeperResults: defineTable({
    moduleId: v.string(),
    version: v.number(),
    component: v.string(), // "module" | "applet_1" | "applet_2" etc.
    passed: v.boolean(),
    ruleResults: v.array(
      v.object({
        ruleId: v.string(),
        ruleName: v.string(),
        passed: v.boolean(),
        evidence: v.optional(v.string()),
        slideNumbers: v.optional(v.array(v.number())),
      })
    ),
    agentName: v.string(),
    completedAt: v.string(),
    dedupKey: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_component", ["moduleId", "version", "component"])
    .index("by_dedupKey", ["dedupKey"]),

  // Per-component scoring — spine + applet rows per module+version
  reviewScores: defineTable({
    moduleId: v.string(),
    version: v.number(),
    reviewPass: v.string(), // "spine" | "applet_1" | "applet_2" etc.
    quadrantScores: v.array(
      v.object({
        quadrantId: v.string(),       // "P" | "D" | "X" | "L"
        quadrantName: v.string(),     // "Pedagogy" | etc.
        maxPoints: v.number(),        // 25
        score: v.number(),
        criteriaScores: v.array(
          v.object({
            criterionId: v.string(),    // "P1", "D3", etc.
            criterionName: v.string(),
            maxPoints: v.number(),      // variable: 2-5
            score: v.number(),
            type: v.optional(v.string()),       // "presence" | "trace"
            evidence: v.optional(v.string()),
            slideNumbers: v.optional(v.array(v.number())),
          })
        ),
      })
    ),
    totalPoints: v.number(),
    maxPoints: v.number(),
    observations: v.optional(v.string()),
    agentName: v.string(),
    completedAt: v.string(),
    dedupKey: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_pass", ["moduleId", "version", "reviewPass"])
    .index("by_dedupKey", ["dedupKey"]),

  // Recommendations — Vinay reviews these (replaces fixDirectives)
  recommendations: defineTable({
    moduleId: v.string(),
    version: v.number(),
    directiveIndex: v.number(),
    slideNumber: v.optional(v.number()),
    issue: v.string(),
    quadrantId: v.string(),              // "P" | "D" | "X" | "L" | "GATE"
    recommendedFix: v.string(),
    why: v.optional(v.string()),
    operationType: v.string(),           // "DELETE"|"INSERT"|"EDIT"|"REPLACE"|"ADD"
    confidence: v.string(),              // "high"|"medium"|"low"
    sourceAttribution: v.optional(v.string()),
    component: v.string(),               // "spine"|"applet_1"|"applet_2" etc.
    pointsRecoverable: v.optional(v.number()),
    sourcePass: v.string(),
    priority: v.optional(v.number()),
    reviewStatus: v.string(),            // "pending"|"accepted"|"rejected"
    vinayComment: v.optional(v.string()),
    reviewedAt: v.optional(v.string()),
    agentName: v.string(),
    source: v.optional(v.string()),       // "agent" (default/omitted) | "reviewer"
    fixStatus: v.optional(v.string()),   // "fixed" | "partially_fixed" | "not_fixed" (corrections flow only)
    createdAt: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_status", ["moduleId", "version", "reviewStatus"])
    .index("by_reviewStatus", ["reviewStatus"]),

  // Flow map — structural map of module (Flow Mapper agent output)
  flowMap: defineTable({
    moduleId: v.string(),
    version: v.number(),
    stepIndex: v.number(),
    type: v.string(),                    // "spine" | "applet"
    slideRange: v.string(),             // "1-15"
    concept: v.string(),
    purpose: v.string(),
    appletRef: v.optional(v.string()),
    status: v.string(),                  // "ok" | "flagged"
    vinayFlag: v.optional(v.string()),
    flaggedAt: v.optional(v.string()),
    agentName: v.string(),
    createdAt: v.string(),
    dedupKey: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_dedupKey", ["dedupKey"]),

  // Token usage tracking — one row per agent per module per pipeline run
  tokenUsage: defineTable({
    agentName: v.string(),
    moduleId: v.string(),
    version: v.optional(v.number()),
    totalTokens: v.number(),
    contextTokens: v.optional(v.number()),
    model: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    sessionKey: v.optional(v.string()),
    timestamp: v.string(),
    dedupKey: v.string(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_agentName", ["agentName"])
    .index("by_moduleId", ["moduleId"])
    .index("by_dedupKey", ["dedupKey"]),

  // Pipeline event log
  agentActivity: defineTable({
    agentName: v.string(),
    action: v.string(),
    status: v.string(),
    message: v.string(),
    timestamp: v.string(),
    metadata: v.optional(v.any()),
    dedupKey: v.optional(v.string()),
  })
    .index("by_agentName", ["agentName"])
    .index("by_timestamp", ["timestamp"])
    .index("by_agentName_timestamp", ["agentName", "timestamp"])
    .index("by_dedupKey", ["dedupKey"]),
});
