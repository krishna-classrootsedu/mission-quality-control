import { mutation, internalMutation } from "./_generated/server";

// Clear ALL data from ALL tables + file storage — full reset
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["modules", "intakeResults", "parsedSlides", "gatekeeperResults", "reviewScores", "recommendations", "flowMap", "agentActivity"] as const;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }
    // Clear all files from storage (PPTXs + thumbnails)
    const files = await ctx.db.system.query("_storage").collect();
    for (const file of files) {
      await ctx.storage.delete(file._id);
    }
    counts["_storage"] = files.length;
    return counts;
  },
});

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const moduleId = "MOD-g1c4m08-fractions-intro";

    // 1. Module
    await ctx.db.insert("modules", {
      moduleId,
      title: "G1C4M08 Introduction to Fractions",
      learningObjective:
        "Students will understand what fractions represent, identify fractions in everyday objects, and compare simple fractions with like denominators using visual models.",
      grade: 4,
      chapterNumber: 4,
      chapterName: "Fractions and Decimals",
      moduleNumber: 8,
      topic: "Fractions",
      slideCount: 30,
      status: "review_complete",
      version: 1,
      overallScore: 72,
      overallPercentage: 72,
      scoreBand: "upgradeable",
      researchBrief: `## Misconception Inventory — Grade 4 Fractions

**Top 5 student misconceptions (research-backed):**
1. **Bigger denominator = bigger fraction** — Students think 1/8 > 1/4 because 8 > 4. Root cause: treating numerator and denominator as independent whole numbers.
2. **Adding fractions by adding tops and bottoms** — 1/2 + 1/3 = 2/5. Persists even after instruction if not explicitly addressed.
3. **Fractions are always less than 1** — Students don't recognize improper fractions or mixed numbers as valid.
4. **Equal parts means equal shape** — Students reject a rectangle divided into 2 unequal-looking (but equal-area) parts as "not halves."
5. **Number line spacing by numerator** — On a 0-1 line, students place 1/4 at position 1, 2/4 at position 2, ignoring the denominator entirely.

**Sources:** Van de Walle (2018), Petit et al. "Developing Essential Understanding of Fractions" (NCTM), Clarke & Roche (2009)

## Interactive Landscape — Existing Quality Applets

1. **NCTM Illuminations — Fraction Models** — Virtual manipulative with circle, bar, and set models. Strong CPA progression. Free.
2. **GeoGebra — Fraction Number Line** — Drag-to-place fractions on configurable number lines. Good for misconception #5. Free.
3. **PhET — Fraction Matcher** — Game format, matching visual to symbolic representation. Adaptive difficulty. Free.
4. **Math Learning Center — Fraction Bars** — Clean fraction wall with labeling. Excellent for comparison. Free.
5. **Mathigon — Fraction Explorer** — Interactive splitting of shapes with real-time fraction display. Premium.

**Key pattern:** Best applets use immediate visual feedback (not just correct/incorrect) — the student sees the fraction change as they manipulate it.`,
      spineComplete: true,
      totalApplets: 1,
      completedAppletReviews: 1,
      sourceFiles: [
        { filename: "G1C4M08-spine.pptx", type: "spine", label: "spine", slideCount: 26 },
        { filename: "G1C4M08-A1-comparison.pptx", type: "applet", label: "A1", afterSpineSlide: 10, slideCount: 4 },
      ],
      submittedBy: "Priya",
      submittedAt: "2026-03-15T09:00:00Z",
      updatedAt: now,
    });

    // 2. Intake results
    await ctx.db.insert("intakeResults", {
      moduleId,
      version: 1,
      slideCount: 30,
      slideTypes: { content: 18, activity: 8, assessment: 4 },
      detectedLO: "Understand fractions as parts of a whole",
      flags: [],
      agentName: "reader",
      completedAt: "2026-03-15T09:05:00Z",
      dedupKey: "intake-seed-001",
    });

    // 3. Parsed slides (30 slides)
    // Slides 1-10 = spine before applet, 11-14 = applet A1, 15-30 = spine after applet
    const slideData = [
      { n: 1, text: "Introduction to Fractions — Welcome Screen", notes: "Warm greeting, set context for lesson", layout: "Title Slide", src: "spine" },
      { n: 2, text: "What You'll Learn Today — Learning Objectives", notes: "Display LO, connect to prior knowledge of division", layout: "Content", src: "spine" },
      { n: 3, text: "Pizza Party! — Dividing Things Equally", notes: "Anchor activity: pizza split among friends", layout: "Content", src: "spine" },
      { n: 4, text: "What is a Fraction? — Parts of a Whole", notes: "Define numerator and denominator with visual", layout: "Content", src: "spine" },
      { n: 5, text: "Fraction Vocabulary — Numerator & Denominator", notes: "Interactive labeling exercise", layout: "Activity", src: "spine" },
      { n: 6, text: "Fractions in Daily Life — Real Examples", notes: "Photos of Indonesian food, markets, daily objects", layout: "Content", src: "spine" },
      { n: 7, text: "Let's Try! — Identify the Fraction", notes: "Drag-and-drop matching exercise", layout: "Activity", src: "spine" },
      { n: 8, text: "Halves and Quarters — Visual Models", notes: "Circle and rectangle models for 1/2, 1/4", layout: "Content", src: "spine" },
      { n: 9, text: "Practice — Shade the Fraction", notes: "Students shade shapes to show given fractions", layout: "Activity", src: "spine" },
      { n: 10, text: "Checkpoint 1 — Quick Quiz", notes: "3 MCQ questions on fraction identification", layout: "Assessment", src: "spine" },
      { n: 11, text: "Thirds and Sixths — More Models", notes: "Extend to 1/3, 1/6 with fraction bars", layout: "Content", src: "A1" },
      { n: 12, text: "Fraction Wall — Comparing Sizes", notes: "Interactive fraction wall visualization", layout: "Activity", src: "A1" },
      { n: 13, text: "Which is Bigger? — Comparing Fractions", notes: "Like denominators comparison strategy", layout: "Content", src: "A1" },
      { n: 14, text: "Comparing Game — Pick the Larger Fraction", notes: "Gamified comparison with points", layout: "Activity", src: "A1" },
      { n: 15, text: "Story Time — Rina's Birthday Cake", notes: "Narrative problem: cake divided among guests", layout: "Content", src: "spine" },
      { n: 16, text: "Solve It — How Much Cake?", notes: "Guided problem solving with hints", layout: "Activity", src: "spine" },
      { n: 17, text: "Equivalent Fractions — Same Size, Different Names", notes: "Introduce concept with visual proof", layout: "Content", src: "spine" },
      { n: 18, text: "Match the Pairs — Equivalent Fractions", notes: "Matching exercise with immediate feedback", layout: "Activity", src: "spine" },
      { n: 19, text: "Checkpoint 2 — Mid-Module Assessment", notes: "5 mixed questions on comparison and equivalence", layout: "Assessment", src: "spine" },
      { n: 20, text: "Fractions on a Number Line", notes: "Place fractions on 0-1 number line", layout: "Content", src: "spine" },
      { n: 21, text: "Number Line Challenge", notes: "Drag fractions to correct position", layout: "Activity", src: "spine" },
      { n: 22, text: "Unit Fractions — Building Blocks", notes: "Explain unit fractions as building blocks", layout: "Content", src: "spine" },
      { n: 23, text: "Build a Fraction — Using Unit Fractions", notes: "Additive composition with fraction pieces", layout: "Content", src: "spine" },
      { n: 24, text: "Real World Problem — Sharing Equally", notes: "Word problem set in Indonesian school context", layout: "Content", src: "spine" },
      { n: 25, text: "Practice Set — Mixed Problems", notes: "6 problems of increasing difficulty", layout: "Activity", src: "spine" },
      { n: 26, text: "Challenge Round — Fraction Puzzles", notes: "Extension for fast finishers", layout: "Content", src: "spine" },
      { n: 27, text: "Checkpoint 3 — Final Assessment", notes: "8 questions covering all topics", layout: "Assessment", src: "spine" },
      { n: 28, text: "What We Learned — Summary", notes: "Recap key concepts with visual summary", layout: "Content", src: "spine" },
      { n: 29, text: "Great Job! — Achievement Badge", notes: "Celebration screen with badge earned", layout: "Content", src: "spine" },
      { n: 30, text: "What's Next? — Preview of Adding Fractions", notes: "Teaser for next module", layout: "Assessment", src: "spine" },
    ];

    for (const s of slideData) {
      await ctx.db.insert("parsedSlides", {
        moduleId,
        version: 1,
        slideNumber: s.n,
        sourceSlideNumber: s.src === "A1" ? s.n - 10 : s.n,
        sourceFile: s.src,
        slideType: s.layout.toLowerCase(),
        textContent: s.text,
        speakerNotes: s.notes,
        layoutType: s.layout,
        hasAnimation: s.n % 3 === 0,
        agentName: "reader",
        createdAt: "2026-03-15T09:05:00Z",
      });
    }

    // 4. Gatekeeper results — module gates (5 rules)
    await ctx.db.insert("gatekeeperResults", {
      moduleId,
      version: 1,
      component: "module",
      passed: true,
      ruleResults: [
        { ruleId: "G1", ruleName: "LO-Content Alignment", passed: true, evidence: "LO clear and testable, all slides map to it" },
        { ruleId: "G2", ruleName: "Structural Completeness", passed: true, evidence: "All slides have defined roles" },
        { ruleId: "G3", ruleName: "Teacher Self-Sufficiency", passed: true, evidence: "On-screen content sufficient for non-expert teacher" },
        { ruleId: "G4", ruleName: "No Prerequisite Gaps", passed: true, evidence: "All prerequisites covered or stated" },
        { ruleId: "G5", ruleName: "Time Feasibility", passed: true, evidence: "Estimated 28 min, within Grade 3-5 window (25-30 min)" },
      ],
      agentName: "gatekeeper",
      completedAt: "2026-03-15T09:06:00Z",
      dedupKey: "gate-seed-module-001",
    });

    // 4b. Gatekeeper results — applet_1 gates (5 rules)
    await ctx.db.insert("gatekeeperResults", {
      moduleId,
      version: 1,
      component: "applet_1",
      passed: true,
      ruleResults: [
        { ruleId: "G1", ruleName: "Clear LO", passed: true, evidence: "Applet LO connects to parent module LO" },
        { ruleId: "G2", ruleName: "Interactivity Exists", passed: true, evidence: "Drag-drop and comparison interactions defined" },
        { ruleId: "G3", ruleName: "Build-Spec Completeness", passed: true, evidence: "Each screen specifies interactions, feedback, and success conditions" },
        { ruleId: "G4", ruleName: "Storyboard Format Compliance", passed: false, evidence: "Screen 3 missing dev notes zone" },
        { ruleId: "G5", ruleName: "State Flow Defined", passed: true, evidence: "Initial state, transitions, and completion condition present" },
      ],
      agentName: "gatekeeper",
      completedAt: "2026-03-15T09:06:10Z",
      dedupKey: "gate-seed-applet1-001",
    });

    // 5. Flow map
    const flowSteps = [
      { idx: 1, type: "spine", range: "1-4", concept: "Introduction & LO", purpose: "Set context, introduce fraction vocabulary" },
      { idx: 2, type: "spine", range: "5-9", concept: "Core Fraction Concepts", purpose: "Halves, quarters, identification practice" },
      { idx: 3, type: "spine", range: "10", concept: "Checkpoint 1", purpose: "Assess fraction identification" },
      { idx: 4, type: "applet", range: "11-14", concept: "Fraction Comparison", purpose: "Fraction wall, comparing with like denominators", ref: "applet_1" },
      { idx: 5, type: "spine", range: "15-18", concept: "Stories & Equivalence", purpose: "Narrative problems, equivalent fractions" },
      { idx: 6, type: "spine", range: "19", concept: "Checkpoint 2", purpose: "Mid-module assessment" },
      { idx: 7, type: "spine", range: "20-23", concept: "Number Lines & Unit Fractions", purpose: "Abstract representations" },
      { idx: 8, type: "spine", range: "24-26", concept: "Practice & Extension", purpose: "Mixed problems, challenge round" },
      { idx: 9, type: "spine", range: "27-30", concept: "Assessment & Wrap-up", purpose: "Final assessment, summary, badge" },
    ];

    for (const step of flowSteps) {
      await ctx.db.insert("flowMap", {
        moduleId,
        version: 1,
        stepIndex: step.idx,
        type: step.type,
        slideRange: step.range,
        concept: step.concept,
        purpose: step.purpose,
        appletRef: step.ref,
        status: "ok",
        agentName: "flow-mapper",
        createdAt: "2026-03-15T09:06:30Z",
        dedupKey: `flow-seed-${moduleId}-v1-${step.idx}`,
      });
    }

    // 6. Review scores (spine + applet_1) — CRLDS 4-quadrant format
    // Spine review
    await ctx.db.insert("reviewScores", {
      moduleId,
      version: 1,
      reviewPass: "spine",
      quadrantScores: [
        {
          quadrantId: "P", quadrantName: "Pedagogy", maxPoints: 25, score: 18,
          criteriaScores: [
            { criterionId: "P1", criterionName: "LO Alignment", maxPoints: 5, score: 4, type: "presence", evidence: "LO clearly stated and activities align" },
            { criterionId: "P2", criterionName: "Scaffolding Progression", maxPoints: 5, score: 3, evidence: "Good CPA but equivalent fractions jump to abstract too fast" },
            { criterionId: "P3", criterionName: "Misconception Handling", maxPoints: 5, score: 3, evidence: "Missing common misconception alerts in speaker notes" },
            { criterionId: "P4", criterionName: "Assessment Alignment", maxPoints: 5, score: 4, evidence: "Checkpoints cover taught concepts" },
            { criterionId: "P5", criterionName: "Differentiation", maxPoints: 5, score: 4, evidence: "Challenge round for fast finishers, but no easier path" },
          ],
        },
        {
          quadrantId: "D", quadrantName: "Design", maxPoints: 25, score: 16,
          criteriaScores: [
            { criterionId: "D1", criterionName: "Visual Consistency", maxPoints: 5, score: 3, evidence: "Font sizes inconsistent on slides 11-18", slideNumbers: [11, 12, 13, 14, 15, 16, 17, 18] },
            { criterionId: "D2", criterionName: "Color & Contrast", maxPoints: 5, score: 3, evidence: "Fraction models need better color coding" },
            { criterionId: "D3", criterionName: "Layout Clarity", maxPoints: 5, score: 4, evidence: "Generally clean, some slides text-heavy" },
            { criterionId: "D4", criterionName: "Animation Purpose", maxPoints: 5, score: 3, evidence: "Welcome animation too long (8s)" },
            { criterionId: "D5", criterionName: "Cultural Relevance", maxPoints: 5, score: 3, evidence: "Generic stock photos, needs Indonesian context" },
          ],
        },
        {
          quadrantId: "X", quadrantName: "Experience", maxPoints: 25, score: 19,
          criteriaScores: [
            { criterionId: "X1", criterionName: "Engagement Hooks", maxPoints: 5, score: 4, evidence: "Pizza and cake stories are engaging" },
            { criterionId: "X2", criterionName: "Activity Variety", maxPoints: 5, score: 4, evidence: "Good mix of drag-drop, matching, quiz" },
            { criterionId: "X3", criterionName: "Cognitive Load", maxPoints: 5, score: 3, evidence: "Slides 17-23 too concept-dense", slideNumbers: [17, 18, 19, 20, 21, 22, 23] },
            { criterionId: "X4", criterionName: "Hint System", maxPoints: 5, score: 3, evidence: "Only 1 of 8 activities has hints" },
            { criterionId: "X5", criterionName: "Gamification", maxPoints: 5, score: 5, evidence: "Points, badges, comparison game present" },
          ],
        },
        {
          quadrantId: "L", quadrantName: "Learning", maxPoints: 25, score: 19,
          criteriaScores: [
            { criterionId: "L1", criterionName: "Content Accuracy", maxPoints: 5, score: 5, evidence: "All fraction representations correct" },
            { criterionId: "L2", criterionName: "Concept Depth", maxPoints: 5, score: 3, evidence: "Equivalent fractions section needs more scaffolding" },
            { criterionId: "L3", criterionName: "Practice Adequacy", maxPoints: 5, score: 3, evidence: "Not enough practice between new concepts" },
            { criterionId: "L4", criterionName: "Feedback Quality", maxPoints: 5, score: 4, evidence: "Correct/incorrect shown but explanation missing" },
            { criterionId: "L5", criterionName: "Teacher Notes", maxPoints: 5, score: 4, evidence: "Notes present but brief in later slides" },
          ],
        },
      ],
      totalPoints: 72,
      maxPoints: 100,
      observations: "Strong content accuracy and engagement but visual design, scaffolding, and hint coverage need improvement.",
      agentName: "spine-reviewer",
      completedAt: "2026-03-15T09:15:00Z",
      dedupKey: "review-spine-seed-001",
    });

    // Applet 1 review (fraction comparison applet)
    await ctx.db.insert("reviewScores", {
      moduleId,
      version: 1,
      reviewPass: "applet_1",
      quadrantScores: [
        {
          quadrantId: "P", quadrantName: "Pedagogy", maxPoints: 25, score: 20,
          criteriaScores: [
            { criterionId: "P1", criterionName: "LO Alignment", maxPoints: 5, score: 4, evidence: "Applet aligns with comparison LO" },
            { criterionId: "P2", criterionName: "Scaffolding Progression", maxPoints: 5, score: 4, evidence: "Good progression in difficulty" },
            { criterionId: "P3", criterionName: "Misconception Handling", maxPoints: 5, score: 4, evidence: "Addresses 'bigger denominator = bigger fraction' misconception" },
            { criterionId: "P4", criterionName: "Assessment Alignment", maxPoints: 5, score: 4, evidence: "Activities test comparison skill" },
            { criterionId: "P5", criterionName: "Differentiation", maxPoints: 5, score: 4, evidence: "Multiple difficulty levels" },
          ],
        },
        {
          quadrantId: "D", quadrantName: "Design", maxPoints: 25, score: 18,
          criteriaScores: [
            { criterionId: "D1", criterionName: "Visual Consistency", maxPoints: 5, score: 4, evidence: "Consistent within applet" },
            { criterionId: "D2", criterionName: "Color & Contrast", maxPoints: 5, score: 3, evidence: "Fraction wall needs labels" },
            { criterionId: "D3", criterionName: "Layout Clarity", maxPoints: 5, score: 4, evidence: "Clean layout" },
            { criterionId: "D4", criterionName: "Animation Purpose", maxPoints: 5, score: 3, evidence: "Game score not visible during play" },
            { criterionId: "D5", criterionName: "Cultural Relevance", maxPoints: 5, score: 4, evidence: "Uses relatable objects" },
          ],
        },
        {
          quadrantId: "X", quadrantName: "Experience", maxPoints: 25, score: 20,
          criteriaScores: [
            { criterionId: "X1", criterionName: "Engagement Hooks", maxPoints: 5, score: 4, evidence: "Game format is motivating" },
            { criterionId: "X2", criterionName: "Activity Variety", maxPoints: 5, score: 4, evidence: "Wall + game + comparison activities" },
            { criterionId: "X3", criterionName: "Cognitive Load", maxPoints: 5, score: 4, evidence: "Appropriate for applet scope" },
            { criterionId: "X4", criterionName: "Hint System", maxPoints: 5, score: 4, evidence: "Hints available in comparison game" },
            { criterionId: "X5", criterionName: "Gamification", maxPoints: 5, score: 4, evidence: "Points system with streak bonus" },
          ],
        },
        {
          quadrantId: "L", quadrantName: "Learning", maxPoints: 25, score: 18,
          criteriaScores: [
            { criterionId: "L1", criterionName: "Content Accuracy", maxPoints: 5, score: 5, evidence: "All comparisons correct" },
            { criterionId: "L2", criterionName: "Concept Depth", maxPoints: 5, score: 4, evidence: "Good coverage of like-denominator comparison" },
            { criterionId: "L3", criterionName: "Practice Adequacy", maxPoints: 5, score: 4, evidence: "Sufficient practice problems" },
            { criterionId: "L4", criterionName: "Feedback Quality", maxPoints: 5, score: 3, evidence: "Feedback present but could explain more" },
            { criterionId: "L5", criterionName: "Teacher Notes", maxPoints: 5, score: 2, evidence: "Minimal teacher notes for applet" },
          ],
        },
      ],
      totalPoints: 76,
      maxPoints: 100,
      observations: "Strong applet with good pedagogy and engagement. Teacher notes and feedback explanations could improve.",
      agentName: "applet-reviewer",
      completedAt: "2026-03-15T09:16:00Z",
      dedupKey: "review-applet1-seed-001",
    });

    // 7. Recommendations (replaces fix directives)
    const recs: Array<{
      idx: number;
      slide: number | null;
      issue: string;
      fix: string;
      why: string;
      quadrantId: string;
      opType: string;
      confidence: string;
      component: string;
      pts: number;
      source: string;
      priority: number;
      status?: string;
      comment?: string;
    }> = [
      { idx: 1, slide: 11, issue: "Font sizes inconsistent across fraction model slides", fix: "Standardize headers to 28pt bold, body to 18pt regular", why: "Visual inconsistency confuses information hierarchy", quadrantId: "D", opType: "EDIT", confidence: "high", component: "spine", pts: 2, source: "spine-reviewer", priority: 1 },
      { idx: 2, slide: 8, issue: "Fraction circle models use single color — hard to distinguish shaded vs unshaded", fix: "Use contrasting colors: shaded blue (#3B82F6), unshaded gray (#E5E7EB)", why: "Color contrast essential for fraction visualization", quadrantId: "D", opType: "EDIT", confidence: "high", component: "spine", pts: 2, source: "spine-reviewer", priority: 1 },
      { idx: 3, slide: 12, issue: "Fraction wall lacks labels", fix: "Label each row: '1 whole', '1/2', '1/3', '1/4', '1/6'", why: "Unlabeled fraction walls are a known confusion source", quadrantId: "D", opType: "ADD", confidence: "high", component: "applet_1", pts: 2, source: "applet-reviewer", priority: 2 },
      { idx: 4, slide: null, issue: "No progress indicator during activities", fix: "Add progress bar showing slide X of 30", why: "Progress feedback reduces anxiety", quadrantId: "X", opType: "INSERT", confidence: "medium", component: "spine", pts: 2, source: "spine-reviewer", priority: 2 },
      { idx: 5, slide: 17, issue: "Equivalent fractions jump to abstract without concrete examples", fix: "Add 2 concrete visual examples before abstract definition", why: "CPA progression is fundamental", quadrantId: "P", opType: "INSERT", confidence: "high", component: "spine", pts: 3, source: "spine-reviewer", priority: 1 },
      { idx: 6, slide: 7, issue: "Drag-and-drop has no hint system", fix: "Add progressive hints: highlight, show in words, animate", why: "Without hints, struggling students give up", quadrantId: "X", opType: "ADD", confidence: "high", component: "spine", pts: 3, source: "spine-reviewer", priority: 1 },
      { idx: 7, slide: 19, issue: "Assessment feedback shows only Correct/Incorrect", fix: "Add explanatory feedback with reasoning", why: "Explanatory feedback turns assessment into learning", quadrantId: "L", opType: "EDIT", confidence: "high", component: "spine", pts: 2, source: "spine-reviewer", priority: 1 },
      { idx: 8, slide: null, issue: "No common misconception alerts in speaker notes", fix: "Add callouts to slides 4, 13, 17, 20", why: "Anticipating misconceptions is core to quality teaching", quadrantId: "P", opType: "INSERT", confidence: "high", component: "spine", pts: 2, source: "spine-reviewer", priority: 1 },
      { idx: 9, slide: 14, issue: "Game score not visible during gameplay", fix: "Add persistent score counter with streak bonus", why: "Invisible scores provide no motivation", quadrantId: "X", opType: "ADD", confidence: "medium", component: "applet_1", pts: 2, source: "applet-reviewer", priority: 2 },
      { idx: 10, slide: 1, issue: "Welcome animation takes 8 seconds", fix: "Reduce to 3 seconds with Skip button after 1s", why: "Long intros frustrate returning students", quadrantId: "D", opType: "EDIT", confidence: "low", component: "spine", pts: 1, source: "spine-reviewer", priority: 4, status: "accepted", comment: "Agreed — 3 seconds is fine." },
      { idx: 11, slide: 3, issue: "Pizza analogy is overused in fraction education", fix: "Replace with Indonesian market context", why: "Pizza is Western-centric", quadrantId: "D", opType: "REPLACE", confidence: "medium", component: "spine", pts: 1, source: "spine-reviewer", priority: 4, status: "rejected", comment: "Pizza is universally understood. Indonesian examples added on slide 6 instead." },
    ];

    for (const r of recs) {
      await ctx.db.insert("recommendations", {
        moduleId,
        version: 1,
        directiveIndex: r.idx,
        slideNumber: r.slide ?? undefined,
        issue: r.issue,
        quadrantId: r.quadrantId,
        recommendedFix: r.fix,
        why: r.why,
        operationType: r.opType,
        confidence: r.confidence,
        component: r.component,
        pointsRecoverable: r.pts,
        sourcePass: r.source,
        priority: r.priority,
        reviewStatus: r.status ?? "pending",
        vinayComment: r.comment,
        reviewedAt: r.status ? "2026-03-16T14:00:00Z" : undefined,
        agentName: "integrator",
        createdAt: "2026-03-15T09:20:00Z",
      });
    }

    // 8. Activity log
    const activities = [
      { agent: "system", action: "module_submitted", message: 'Module "G1C4M08 Introduction to Fractions" submitted by Priya' },
      { agent: "reader", action: "intake_complete", message: "Parsed 30 slides for G1C4M08" },
      { agent: "gatekeeper", action: "gatekeeper_pass", message: "Gatekeeper PASSED for G1C4M08 — all 9 rules passed" },
      { agent: "flow-mapper", action: "flow_map_pushed", message: "Flow map: 9 steps for G1C4M08" },
      { agent: "spine-reviewer", action: "review_scores_pushed", message: "Spine review: 72/100 (72%) for G1C4M08" },
      { agent: "applet-reviewer", action: "review_scores_pushed", message: "Applet 1 review: 76/100 (76%) for G1C4M08" },
      { agent: "integrator", action: "recommendations_pushed", message: "11 recommendations for G1C4M08. Band: upgradeable" },
    ];

    for (let i = 0; i < activities.length; i++) {
      await ctx.db.insert("agentActivity", {
        agentName: activities[i].agent,
        action: activities[i].action,
        status: "success",
        message: activities[i].message,
        timestamp: new Date(Date.parse("2026-03-15T09:00:00Z") + i * 300000).toISOString(),
        dedupKey: `seed-activity-${i}`,
      });
    }

    return { moduleId, recommendations: recs.length, slides: slideData.length };
  },
});
