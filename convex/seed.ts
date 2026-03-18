import { mutation } from "./_generated/server";

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
      grade: "4",
      phase: "Phase 2",
      topic: "Fractions",
      slideCount: 30,
      status: "review_complete",
      version: 1,
      overallScore: 86,
      overallPercentage: 72,
      scoreBand: "upgradeable",
      tier1AllPassed: false,
      designerComplete: true,
      teacherComplete: true,
      studentComplete: true,
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
    const slideData = [
      {
        n: 1,
        text: "Introduction to Fractions — Welcome Screen",
        notes: "Warm greeting, set context for lesson",
        layout: "Title Slide",
      },
      {
        n: 2,
        text: "What You'll Learn Today — Learning Objectives",
        notes: "Display LO, connect to prior knowledge of division",
        layout: "Content",
      },
      {
        n: 3,
        text: "Pizza Party! — Dividing Things Equally",
        notes: "Anchor activity: pizza split among friends",
        layout: "Content",
      },
      {
        n: 4,
        text: "What is a Fraction? — Parts of a Whole",
        notes: "Define numerator and denominator with visual",
        layout: "Content",
      },
      {
        n: 5,
        text: "Fraction Vocabulary — Numerator & Denominator",
        notes: "Interactive labeling exercise",
        layout: "Activity",
      },
      {
        n: 6,
        text: "Fractions in Daily Life — Real Examples",
        notes: "Photos of Indonesian food, markets, daily objects",
        layout: "Content",
      },
      {
        n: 7,
        text: "Let's Try! — Identify the Fraction",
        notes: "Drag-and-drop matching exercise",
        layout: "Activity",
      },
      {
        n: 8,
        text: "Halves and Quarters — Visual Models",
        notes: "Circle and rectangle models for 1/2, 1/4",
        layout: "Content",
      },
      {
        n: 9,
        text: "Practice — Shade the Fraction",
        notes: "Students shade shapes to show given fractions",
        layout: "Activity",
      },
      {
        n: 10,
        text: "Checkpoint 1 — Quick Quiz",
        notes: "3 MCQ questions on fraction identification",
        layout: "Assessment",
      },
      {
        n: 11,
        text: "Thirds and Sixths — More Models",
        notes: "Extend to 1/3, 1/6 with fraction bars",
        layout: "Content",
      },
      {
        n: 12,
        text: "Fraction Wall — Comparing Sizes",
        notes: "Interactive fraction wall visualization",
        layout: "Activity",
      },
      {
        n: 13,
        text: "Which is Bigger? — Comparing Fractions",
        notes: "Like denominators comparison strategy",
        layout: "Content",
      },
      {
        n: 14,
        text: "Comparing Game — Pick the Larger Fraction",
        notes: "Gamified comparison with points",
        layout: "Activity",
      },
      {
        n: 15,
        text: "Story Time — Rina's Birthday Cake",
        notes: "Narrative problem: cake divided among guests",
        layout: "Content",
      },
      {
        n: 16,
        text: "Solve It — How Much Cake?",
        notes: "Guided problem solving with hints",
        layout: "Activity",
      },
      {
        n: 17,
        text: "Equivalent Fractions — Same Size, Different Names",
        notes: "Introduce concept with visual proof",
        layout: "Content",
      },
      {
        n: 18,
        text: "Match the Pairs — Equivalent Fractions",
        notes: "Matching exercise with immediate feedback",
        layout: "Activity",
      },
      {
        n: 19,
        text: "Checkpoint 2 — Mid-Module Assessment",
        notes: "5 mixed questions on comparison and equivalence",
        layout: "Assessment",
      },
      {
        n: 20,
        text: "Fractions on a Number Line",
        notes: "Place fractions on 0-1 number line",
        layout: "Content",
      },
      {
        n: 21,
        text: "Number Line Challenge",
        notes: "Drag fractions to correct position",
        layout: "Activity",
      },
      {
        n: 22,
        text: "Unit Fractions — Building Blocks",
        notes: "Explain unit fractions as building blocks",
        layout: "Content",
      },
      {
        n: 23,
        text: "Build a Fraction — Using Unit Fractions",
        notes: "Additive composition with fraction pieces",
        layout: "Content",
      },
      {
        n: 24,
        text: "Real World Problem — Sharing Equally",
        notes: "Word problem set in Indonesian school context",
        layout: "Content",
      },
      {
        n: 25,
        text: "Practice Set — Mixed Problems",
        notes: "6 problems of increasing difficulty",
        layout: "Activity",
      },
      {
        n: 26,
        text: "Challenge Round — Fraction Puzzles",
        notes: "Extension for fast finishers",
        layout: "Content",
      },
      {
        n: 27,
        text: "Checkpoint 3 — Final Assessment",
        notes: "8 questions covering all topics",
        layout: "Assessment",
      },
      {
        n: 28,
        text: "What We Learned — Summary",
        notes: "Recap key concepts with visual summary",
        layout: "Content",
      },
      {
        n: 29,
        text: "Great Job! — Achievement Badge",
        notes: "Celebration screen with badge earned",
        layout: "Content",
      },
      {
        n: 30,
        text: "What's Next? — Preview of Adding Fractions",
        notes: "Teaser for next module",
        layout: "Assessment",
      },
    ];

    for (const s of slideData) {
      await ctx.db.insert("parsedSlides", {
        moduleId,
        version: 1,
        slideNumber: s.n,
        slideType: s.layout.toLowerCase(),
        textContent: s.text,
        speakerNotes: s.notes,
        layoutType: s.layout,
        hasAnimation: s.n % 3 === 0,
        agentName: "reader",
        createdAt: "2026-03-15T09:05:00Z",
      });
    }

    // 4. Gatekeeper results (passed)
    await ctx.db.insert("gatekeeperResults", {
      moduleId,
      version: 1,
      passed: true,
      ruleResults: [
        {
          ruleId: "R0.1",
          ruleName: "LO Present in Speaker Notes",
          passed: true,
          evidence: "Found in slide 2 speaker notes",
        },
        {
          ruleId: "R0.2",
          ruleName: "Minimum 15 Slides",
          passed: true,
          evidence: "30 slides found",
        },
        {
          ruleId: "R0.4",
          ruleName: "At Least 3 Interactive Activities",
          passed: true,
          evidence: "8 activity slides found",
        },
        {
          ruleId: "R0.5",
          ruleName: "At Least 1 Assessment Checkpoint",
          passed: true,
          evidence: "3 assessment slides found",
        },
        {
          ruleId: "R0.6",
          ruleName: "No Blank Slides",
          passed: true,
          evidence: "All slides have content",
        },
        {
          ruleId: "R0.7",
          ruleName: "Title Slide Present",
          passed: true,
          evidence: "Slide 1 is a title slide",
        },
      ],
      agentName: "gatekeeper",
      completedAt: "2026-03-15T09:06:00Z",
      dedupKey: "gate-seed-001",
    });

    // 5. Review scores (3 passes)
    // Designer pass (A, B, G, V, J)
    await ctx.db.insert("reviewScores", {
      moduleId,
      version: 1,
      reviewPass: "designer",
      categoryScores: [
        {
          categoryId: "A",
          categoryName: "Activity Design & Engagement",
          maxPoints: 12,
          score: 9,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "A1",
              criterionName: "Activity variety",
              maxPoints: 4,
              score: 3,
              evidence:
                "Good mix of drag-drop, matching, and quiz formats",
            },
            {
              criterionId: "A2",
              criterionName: "Engagement hooks",
              maxPoints: 4,
              score: 3,
              evidence:
                "Pizza analogy is strong, but some activities feel repetitive",
            },
            {
              criterionId: "A3",
              criterionName: "Interactivity depth",
              maxPoints: 4,
              score: 3,
              evidence:
                "Most activities are click-based, limited manipulation",
            },
          ],
        },
        {
          categoryId: "B",
          categoryName: "Visual Design & Layout",
          maxPoints: 12,
          score: 7,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "B1",
              criterionName: "Visual consistency",
              maxPoints: 4,
              score: 2,
              evidence:
                "Inconsistent font sizes between slides 11-18",
              slideNumbers: [11, 12, 13, 14, 15, 16, 17, 18],
            },
            {
              criterionId: "B2",
              criterionName: "Layout clarity",
              maxPoints: 4,
              score: 3,
              evidence:
                "Generally clean but some slides too text-heavy",
            },
            {
              criterionId: "B3",
              criterionName: "Visual aids",
              maxPoints: 4,
              score: 2,
              evidence:
                "Fraction models need color coding for clarity",
              slideNumbers: [8, 11, 12],
            },
          ],
        },
        {
          categoryId: "G",
          categoryName: "Gamification & Rewards",
          maxPoints: 10,
          score: 7,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "G1",
              criterionName: "Point/badge system",
              maxPoints: 5,
              score: 4,
              evidence:
                "Badge on slide 29, but no running score counter",
            },
            {
              criterionId: "G2",
              criterionName: "Progress feedback",
              maxPoints: 5,
              score: 3,
              evidence: "No progress bar visible during activities",
            },
          ],
        },
        {
          categoryId: "V",
          categoryName: "Voice & Tone",
          maxPoints: 10,
          score: 8,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "V1",
              criterionName: "Age-appropriate language",
              maxPoints: 5,
              score: 4,
              evidence: "Good vocabulary level for Grade 4",
            },
            {
              criterionId: "V2",
              criterionName: "Encouraging tone",
              maxPoints: 5,
              score: 4,
              evidence:
                "Positive reinforcement present, could be more enthusiastic",
            },
          ],
        },
        {
          categoryId: "J",
          categoryName: "Journey & Progression",
          maxPoints: 10,
          score: 7,
          tier: "tier2",
          criteriaScores: [
            {
              criterionId: "J1",
              criterionName: "Logical flow",
              maxPoints: 5,
              score: 4,
              evidence:
                "Good progression from concrete to abstract",
            },
            {
              criterionId: "J2",
              criterionName: "Pacing",
              maxPoints: 5,
              score: 3,
              evidence:
                "Slides 17-23 feel rushed — too many new concepts without practice",
            },
          ],
        },
      ],
      totalPoints: 38,
      maxPoints: 54,
      observations:
        "Strong activity variety but visual design needs polish. Gamification could be more prominent.",
      agentName: "designer-reviewer",
      completedAt: "2026-03-15T09:15:00Z",
      dedupKey: "review-designer-seed-001",
    });

    // Teacher pass (C, D, K, T)
    await ctx.db.insert("reviewScores", {
      moduleId,
      version: 1,
      reviewPass: "teacher",
      categoryScores: [
        {
          categoryId: "C",
          categoryName: "Content Accuracy & Depth",
          maxPoints: 10,
          score: 8,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "C1",
              criterionName: "Mathematical accuracy",
              maxPoints: 5,
              score: 5,
              evidence: "All fraction representations are correct",
            },
            {
              criterionId: "C2",
              criterionName: "Conceptual depth",
              maxPoints: 5,
              score: 3,
              evidence:
                "Equivalent fractions section needs more scaffolding",
              slideNumbers: [17, 18],
            },
          ],
        },
        {
          categoryId: "D",
          categoryName: "Differentiation & Scaffolding",
          maxPoints: 10,
          score: 6,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "D1",
              criterionName: "Hint system",
              maxPoints: 5,
              score: 3,
              evidence:
                "Hints only on slide 16, missing from most activities",
            },
            {
              criterionId: "D2",
              criterionName: "Difficulty levels",
              maxPoints: 5,
              score: 3,
              evidence:
                "No adaptive difficulty — all students get same path",
            },
          ],
        },
        {
          categoryId: "K",
          categoryName: "Knowledge Check & Assessment",
          maxPoints: 8,
          score: 6,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "K1",
              criterionName: "Assessment coverage",
              maxPoints: 4,
              score: 3,
              evidence:
                "Checkpoint 1 only tests identification, not comparison",
            },
            {
              criterionId: "K2",
              criterionName: "Feedback quality",
              maxPoints: 4,
              score: 3,
              evidence:
                "Correct/incorrect feedback but no explanation of why",
            },
          ],
        },
        {
          categoryId: "T",
          categoryName: "Teacher Notes & Guidance",
          maxPoints: 8,
          score: 6,
          tier: "tier1",
          criteriaScores: [
            {
              criterionId: "T1",
              criterionName: "Notes completeness",
              maxPoints: 4,
              score: 3,
              evidence:
                "Speaker notes present but brief on slides 20-26",
            },
            {
              criterionId: "T2",
              criterionName: "Pedagogical guidance",
              maxPoints: 4,
              score: 3,
              evidence: "Missing common misconception alerts",
            },
          ],
        },
      ],
      totalPoints: 26,
      maxPoints: 36,
      observations:
        "Content is accurate but scaffolding and differentiation need work. Assessment feedback should explain 'why'.",
      agentName: "teacher-reviewer",
      completedAt: "2026-03-15T09:15:00Z",
      dedupKey: "review-teacher-seed-001",
    });

    // Student pass (E, F, H)
    await ctx.db.insert("reviewScores", {
      moduleId,
      version: 1,
      reviewPass: "student",
      categoryScores: [
        {
          categoryId: "E",
          categoryName: "Student Experience & Flow",
          maxPoints: 10,
          score: 7,
          tier: "tier2",
          criteriaScores: [
            {
              criterionId: "E1",
              criterionName: "Cognitive load",
              maxPoints: 5,
              score: 3,
              evidence:
                "Slides 17-23 introduce too many concepts without breaks",
              slideNumbers: [17, 18, 19, 20, 21, 22, 23],
            },
            {
              criterionId: "E2",
              criterionName: "Navigation clarity",
              maxPoints: 5,
              score: 4,
              evidence:
                "Clear progression but no 'go back' option",
            },
          ],
        },
        {
          categoryId: "F",
          categoryName: "Fun & Motivation",
          maxPoints: 10,
          score: 8,
          tier: "tier2",
          criteriaScores: [
            {
              criterionId: "F1",
              criterionName: "Fun factor",
              maxPoints: 5,
              score: 4,
              evidence: "Pizza and cake stories are engaging",
            },
            {
              criterionId: "F2",
              criterionName: "Character/personality",
              maxPoints: 5,
              score: 4,
              evidence:
                "Rina's story adds personality, could use more characters",
            },
          ],
        },
        {
          categoryId: "H",
          categoryName: "Hints & Help System",
          maxPoints: 10,
          score: 7,
          tier: "tier2",
          criteriaScores: [
            {
              criterionId: "H1",
              criterionName: "Hint availability",
              maxPoints: 5,
              score: 3,
              evidence: "Only 1 activity has hints (slide 16)",
            },
            {
              criterionId: "H2",
              criterionName: "Hint quality",
              maxPoints: 5,
              score: 4,
              evidence:
                "The one hint provided is well-scaffolded",
            },
          ],
        },
      ],
      totalPoints: 22,
      maxPoints: 30,
      observations:
        "Good engagement through stories but needs more hint support and cognitive load management.",
      agentName: "student-reviewer",
      completedAt: "2026-03-15T09:15:00Z",
      dedupKey: "review-student-seed-001",
    });

    // 6. Fix directives (25 total)
    const directives: Array<{
      idx: number;
      slide: number | null;
      issue: string;
      fix: string;
      why: string;
      severity: string;
      cat: string;
      source: string;
      type: string;
      priority: number;
      status?: string;
      comment?: string;
    }> = [
      // Tier 1 — Designer issues
      {
        idx: 1,
        slide: 11,
        issue:
          "Font sizes inconsistent across fraction model slides — headers range from 24pt to 32pt with no pattern",
        fix: "Standardize all fraction model slide headers to 28pt bold, body text to 18pt regular",
        why: "Visual inconsistency makes the module feel unpolished and can confuse students about information hierarchy",
        severity: "tier1",
        cat: "B",
        source: "designer",
        type: "fix",
        priority: 1,
      },
      {
        idx: 2,
        slide: 8,
        issue:
          "Fraction circle models use single color — hard for students to distinguish shaded vs unshaded portions",
        fix: "Use contrasting colors: shaded portion in blue (#3B82F6), unshaded in light gray (#E5E7EB). Add thin black border between sections.",
        why: "Color contrast is essential for fraction visualization, especially for students with color vision differences",
        severity: "tier1",
        cat: "B",
        source: "designer",
        type: "fix",
        priority: 1,
      },
      {
        idx: 3,
        slide: 12,
        issue:
          "Fraction wall visualization lacks labels — students can't tell which row represents which unit fraction",
        fix: "Label each row of the fraction wall: '1 whole', '1/2', '1/3', '1/4', '1/6' on the left edge",
        why: "Unlabeled fraction walls are a known source of confusion in Grade 4 — labels are scaffolding, not clutter",
        severity: "tier1",
        cat: "B",
        source: "designer",
        type: "fix",
        priority: 2,
      },
      {
        idx: 4,
        slide: null,
        issue:
          "No progress indicator visible during activities — students don't know how far through the module they are",
        fix: "Add a subtle progress bar at the top of each slide showing 'Slide X of 30' or a percentage-based progress ring",
        why: "Progress feedback reduces anxiety and helps students pace themselves, especially in self-directed learning",
        severity: "tier1",
        cat: "G",
        source: "designer",
        type: "insert",
        priority: 2,
      },
      {
        idx: 5,
        slide: 29,
        issue:
          "Achievement badge screen has no specific achievement — just says 'Great Job!'",
        fix: "Replace generic badge with a named achievement: 'Fraction Explorer Badge' with 3 specific skills mastered listed below",
        why: "Specific recognition reinforces what was learned and makes the reward feel earned, not automatic",
        severity: "tier1",
        cat: "G",
        source: "designer",
        type: "fix",
        priority: 3,
      },

      // Tier 1 — Teacher issues
      {
        idx: 6,
        slide: 17,
        issue:
          "Equivalent fractions introduced without sufficient concrete examples — jumps straight to abstract notation",
        fix: "Add 2 concrete visual examples before the abstract definition: show 1/2 = 2/4 with pizza slices, then 1/3 = 2/6 with chocolate bars",
        why: "CPA progression (Concrete → Pictorial → Abstract) is fundamental — skipping concrete stage causes misconceptions",
        severity: "tier1",
        cat: "C",
        source: "teacher",
        type: "insert",
        priority: 1,
      },
      {
        idx: 7,
        slide: 7,
        issue:
          "Drag-and-drop exercise has no hint system — struggling students hit a wall with no way forward",
        fix: "Add progressive hints: (1) highlight the correct region, (2) show the fraction in words, (3) demonstrate with animation",
        why: "Without hints, struggling students either guess randomly or give up — neither leads to learning",
        severity: "tier1",
        cat: "D",
        source: "teacher",
        type: "fix",
        priority: 1,
      },
      {
        idx: 8,
        slide: 9,
        issue:
          "Shade-the-fraction activity provides no feedback on incorrect attempts",
        fix: "Add immediate visual feedback: green glow + checkmark for correct, gentle red highlight + 'Try again — count the total parts first' for incorrect",
        why: "Immediate corrective feedback is the single most effective learning intervention for procedural skills",
        severity: "tier1",
        cat: "D",
        source: "teacher",
        type: "fix",
        priority: 2,
      },
      {
        idx: 9,
        slide: 10,
        issue:
          "Checkpoint 1 only tests fraction identification — doesn't cover comparing fractions introduced in slides 8-9",
        fix: "Add 2 comparison questions to Checkpoint 1: 'Which is larger: 1/2 or 1/4?' and 'Which is larger: 2/4 or 3/4?'",
        why: "Assessments must align with what was taught — testing only half the content gives an incomplete picture",
        severity: "tier1",
        cat: "K",
        source: "teacher",
        type: "fix",
        priority: 2,
      },
      {
        idx: 10,
        slide: 19,
        issue:
          "Assessment feedback shows only 'Correct!' or 'Incorrect' — no explanation of the reasoning",
        fix: "Add explanatory feedback: for correct answers, 'Yes! 2/4 equals 1/2 because both represent the same amount.' For incorrect, 'Not quite — try comparing using the fraction wall on the left.'",
        why: "Explanatory feedback turns assessment into a learning opportunity, not just a checkpoint",
        severity: "tier1",
        cat: "K",
        source: "teacher",
        type: "fix",
        priority: 1,
      },
      {
        idx: 11,
        slide: 20,
        issue:
          "Speaker notes for number line section are too brief — just 'Place fractions on 0-1 number line'",
        fix: "Expand notes: 'Start by placing 0 and 1. Then find 1/2 (halfway). Use 1/2 as an anchor to place 1/4 and 3/4. Key misconception: students may space fractions by numerator only.'",
        why: "Teacher notes should anticipate misconceptions — number line fractions are notoriously tricky for Grade 4",
        severity: "tier1",
        cat: "T",
        source: "teacher",
        type: "fix",
        priority: 3,
      },
      {
        idx: 12,
        slide: null,
        issue:
          "No common misconception alerts anywhere in speaker notes",
        fix: "Add misconception callouts to slides 4 (numerator/denominator confusion), 13 (larger denominator = larger fraction), 17 (equivalent means same digits), 20 (fraction spacing on number line)",
        why: "Anticipating misconceptions is core to quality teaching — every content team member should know the top 4 for this topic",
        severity: "tier1",
        cat: "T",
        source: "teacher",
        type: "insert",
        priority: 1,
      },

      // Tier 1 — Integrator synthesis
      {
        idx: 13,
        slide: 14,
        issue:
          "Comparison game awards points but score is not visible during gameplay — defeats the purpose of gamification",
        fix: "Add a persistent score counter in the top-right corner that animates when points are earned. Show streak bonus for 3+ correct in a row.",
        why: "Invisible scores provide no motivation loop — the student needs to see their progress in real-time",
        severity: "tier1",
        cat: "G",
        source: "integrator",
        type: "fix",
        priority: 2,
      },
      {
        idx: 14,
        slide: 5,
        issue:
          "Interactive labeling exercise for numerator/denominator has no visual connection to the definition on slide 4",
        fix: "Add a small reference panel on slide 5 showing the fraction diagram from slide 4 with labels highlighted",
        why: "Cognitive science: working memory is limited — referencing the prior slide reduces cognitive load during practice",
        severity: "tier1",
        cat: "A",
        source: "integrator",
        type: "fix",
        priority: 3,
      },

      // Tier 2 — Student experience issues
      {
        idx: 15,
        slide: 17,
        issue:
          "Slides 17-23 introduce 4 new concepts (equivalent fractions, number lines, unit fractions, additive composition) with only 1 practice activity",
        fix: "Add a practice activity after slide 20 (number line) and another after slide 23 (unit fractions). Each should have 3-4 scaffolded problems.",
        why: "Concept density without practice leads to surface-level understanding — space concepts with interleaved practice",
        severity: "tier2",
        cat: "E",
        source: "student",
        type: "insert",
        priority: 1,
      },
      {
        idx: 16,
        slide: 21,
        issue:
          "Number line challenge has no 'undo' — if a student places a fraction incorrectly, they can't move it",
        fix: "Allow drag-to-reposition for placed fractions. Add a 'Reset' button to start over.",
        why: "Trial-and-error is how students learn spatial reasoning — blocking corrections blocks learning",
        severity: "tier2",
        cat: "E",
        source: "student",
        type: "fix",
        priority: 2,
      },
      {
        idx: 17,
        slide: 15,
        issue:
          "Rina's birthday cake story is engaging but only used once — missed opportunity for a recurring character",
        fix: "Bring Rina back in slides 20 and 24 as the character encountering fraction problems. Build a mini-narrative arc.",
        why: "Recurring characters create emotional investment — students care about Rina's problems more than abstract ones",
        severity: "tier2",
        cat: "F",
        source: "student",
        type: "fix",
        priority: 3,
      },
      {
        idx: 18,
        slide: 25,
        issue:
          "Practice set jumps from easy to hard with no medium-difficulty bridge problems",
        fix: "Restructure the 6 problems: 2 easy (single visual), 2 medium (compare with like denominators), 2 hard (equivalent fractions without visuals)",
        why: "Smooth difficulty curves prevent frustration — a sudden jump makes students feel they 'don't get it'",
        severity: "tier2",
        cat: "E",
        source: "student",
        type: "fix",
        priority: 2,
      },

      // Tier 2 — Hint system
      {
        idx: 19,
        slide: 16,
        issue:
          "The hint on slide 16 is well-designed but it's the ONLY hint in the entire 30-slide module",
        fix: "Replicate the 3-tier hint pattern from slide 16 across all 8 activity slides (7, 9, 14, 16, 18, 21, 25, 26)",
        why: "A single hint in 30 slides is worse than no hints — it sets an expectation that isn't met elsewhere",
        severity: "tier2",
        cat: "H",
        source: "student",
        type: "fix",
        priority: 1,
      },

      // More designer issues
      {
        idx: 20,
        slide: 26,
        issue:
          "Challenge round slide has no visual distinction from regular content — fast finishers may not realize it's optional/bonus",
        fix: "Add a 'BONUS' banner, star border decoration, and different background gradient to clearly mark this as an extension activity",
        why: "Optional content must be visually distinct so students don't feel bad for skipping it if they need to",
        severity: "tier2",
        cat: "J",
        source: "designer",
        type: "fix",
        priority: 3,
      },
      {
        idx: 21,
        slide: 6,
        issue:
          "Indonesian context examples are generic stock photos — not relatable to Grade 4 students in Indonesian schools",
        fix: "Replace stock photos with illustrations of: tahu (tofu) cut into fractions, a kue lapis (layer cake) showing layers, and a batik pattern with fractional repeats",
        why: "Cultural relevance increases engagement — students should see their own world reflected in math examples",
        severity: "tier1",
        cat: "V",
        source: "designer",
        type: "fix",
        priority: 2,
      },

      // Already reviewed (accepted)
      {
        idx: 22,
        slide: 1,
        issue:
          "Welcome screen animation takes 8 seconds before any content is visible — too slow for repeat visitors",
        fix: "Reduce animation to 3 seconds with a 'Skip' button visible after 1 second",
        why: "Long intros frustrate returning students and waste class time",
        severity: "tier2",
        cat: "E",
        source: "student",
        type: "fix",
        priority: 4,
        status: "accepted",
        comment:
          "Agreed — animation should never block learning. 3 seconds is fine.",
      },
      {
        idx: 23,
        slide: 28,
        issue:
          "Summary slide lists all 30 slide titles — too much text, defeats the purpose of a summary",
        fix: "Replace with a visual concept map showing 5 key concepts connected: whole, parts, numerator, denominator, equivalent",
        why: "A summary should consolidate, not repeat — visual concept maps aid retention",
        severity: "tier2",
        cat: "A",
        source: "integrator",
        type: "fix",
        priority: 3,
        status: "accepted",
      },

      // Already reviewed (rejected)
      {
        idx: 24,
        slide: 3,
        issue:
          "Pizza analogy is overused in fraction education — consider using a more original anchor context",
        fix: "Replace pizza with a traditional Indonesian market context: dividing rambutan, cutting tempe blocks, sharing nasi tumpeng",
        why: "Pizza is Western-centric and overused — Indonesian contexts would be more authentic",
        severity: "tier2",
        cat: "V",
        source: "teacher",
        type: "fix",
        priority: 4,
        status: "rejected",
        comment:
          "Pizza is universally understood and the kids love it. The Indonesian examples are added on slide 6 instead — no need to replace the anchor.",
      },
      {
        idx: 25,
        slide: 30,
        issue:
          "Preview slide for next module feels abrupt — no transition from celebration to 'what's next'",
        fix: "Delete slide 30 entirely — end on the achievement badge. Add 'What's Next' as a small text line on the badge slide instead.",
        why: "Ending on a high note (badge) is better than immediately pivoting to new content",
        severity: "tier2",
        cat: "J",
        source: "designer",
        type: "delete",
        priority: 5,
        status: "rejected",
        comment:
          "We need the preview slide — it's a content team requirement for all modules. But I agree the transition is abrupt, so smooth it with a brief sentence.",
      },
    ];

    for (const d of directives) {
      await ctx.db.insert("fixDirectives", {
        moduleId,
        version: 1,
        directiveIndex: d.idx,
        slideNumber: d.slide ?? undefined,
        issue: d.issue,
        categoryId: d.cat,
        recommendedFix: d.fix,
        why: d.why,
        severity: d.severity,
        scoreImpact: d.severity === "tier1" ? 3 : 2,
        sourcePass: d.source,
        directiveType: d.type,
        priority: d.priority,
        reviewStatus: d.status ?? "pending",
        vinayComment: d.comment,
        reviewedAt: d.status ? "2026-03-16T14:00:00Z" : undefined,
        agentName: "integrator",
        createdAt: "2026-03-15T09:20:00Z",
      });
    }

    // 7. Activity log
    const activities = [
      {
        agent: "system",
        action: "module_submitted",
        message:
          'Module "G1C4M08 Introduction to Fractions" submitted by Priya',
      },
      {
        agent: "reader",
        action: "intake_complete",
        message: "Parsed 30 slides for G1C4M08",
      },
      {
        agent: "gatekeeper",
        action: "gatekeeper_pass",
        message:
          "Gatekeeper PASSED for G1C4M08 — all 6 rules passed",
      },
      {
        agent: "designer-reviewer",
        action: "review_scores_pushed",
        message: "Designer review: 38/54 (70%) for G1C4M08",
      },
      {
        agent: "teacher-reviewer",
        action: "review_scores_pushed",
        message: "Teacher review: 26/36 (72%) for G1C4M08",
      },
      {
        agent: "student-reviewer",
        action: "review_scores_pushed",
        message: "Student review: 22/30 (73%) for G1C4M08",
      },
      {
        agent: "integrator",
        action: "fix_directives_pushed",
        message:
          "25 fix directives for G1C4M08. Band: upgradeable",
      },
    ];

    for (let i = 0; i < activities.length; i++) {
      await ctx.db.insert("agentActivity", {
        agentName: activities[i].agent,
        action: activities[i].action,
        status: "success",
        message: activities[i].message,
        timestamp: new Date(
          Date.parse("2026-03-15T09:00:00Z") + i * 300000
        ).toISOString(),
        dedupKey: `seed-activity-${i}`,
      });
    }

    return {
      moduleId,
      directives: directives.length,
      slides: slideData.length,
    };
  },
});
