import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per module submission
  modules: defineTable({
    moduleId: v.string(),
    title: v.string(),
    learningObjective: v.string(),
    grade: v.string(),
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
    tier1AllPassed: v.optional(v.boolean()),
    // Parallel pass tracking
    designerComplete: v.optional(v.boolean()),
    teacherComplete: v.optional(v.boolean()),
    studentComplete: v.optional(v.boolean()),
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
    metadata: v.optional(v.any()),
    agentName: v.string(),
    createdAt: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_slide", ["moduleId", "version", "slideNumber"]),

  // Binary rule check — one per module+version
  gatekeeperResults: defineTable({
    moduleId: v.string(),
    version: v.number(),
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
    .index("by_dedupKey", ["dedupKey"]),

  // Per-hat scoring — 3 rows per module+version
  reviewScores: defineTable({
    moduleId: v.string(),
    version: v.number(),
    reviewPass: v.string(), // "designer" | "teacher" | "student"
    categoryScores: v.array(
      v.object({
        categoryId: v.string(),
        categoryName: v.string(),
        maxPoints: v.number(),
        score: v.number(),
        tier: v.string(),
        criteriaScores: v.array(
          v.object({
            criterionId: v.string(),
            criterionName: v.string(),
            maxPoints: v.number(),
            score: v.number(),
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

  // Individual fix directives — Vinay reviews these
  fixDirectives: defineTable({
    moduleId: v.string(),
    version: v.number(),
    directiveIndex: v.number(),
    slideNumber: v.optional(v.number()),
    issue: v.string(),
    categoryId: v.string(),
    recommendedFix: v.string(),
    why: v.optional(v.string()),
    severity: v.string(), // "tier1" | "tier2"
    scoreImpact: v.optional(v.number()),
    sourcePass: v.string(), // "designer" | "teacher" | "student" | "integrator"
    reviewStatus: v.string(), // "pending" | "accepted" | "rejected"
    vinayComment: v.optional(v.string()),
    reviewedAt: v.optional(v.string()),
    agentName: v.string(),
    createdAt: v.string(),
  })
    .index("by_moduleId_version", ["moduleId", "version"])
    .index("by_moduleId_version_status", ["moduleId", "version", "reviewStatus"])
    .index("by_reviewStatus", ["reviewStatus"]),

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
