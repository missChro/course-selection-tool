// ============================================================
// CourseWise — script.js
// All math matches the formula spec in 选课决策系统项目资料.docx
// ============================================================

// ── Mock Course Data ──────────────────────────────────────────
// Fields:
//   name, units, weekly_hours, exam_count,
//   gpa        (historical avg GPA, 0–4 scale)
//   risk       (raw enrollment risk 0–1: 0=easy to get in, 1=very hard)
//   progress   (importance_weight: major_core=1.0, major_prereq=0.8, breadth=0.5, elective=0.3)
//   quality    (professor rating 0–1)
//   paths      (array of academic paths this course serves)
//   prereqs    (array of course names required before taking this)
//   type       (label for display)

const COURSES = [
  {
    name: "UGBA 10",      units: 3, weekly_hours: 6,  exam_count: 2,
    gpa: 3.6, risk: 0.2, progress: 0.5, quality: 0.78,
    paths: ["Haas", "Business"], prereqs: [], type: "breadth"
  },
  {
    name: "STAT 20",      units: 4, weekly_hours: 8,  exam_count: 3,
    gpa: 3.4, risk: 0.4, progress: 0.8, quality: 0.72,
    paths: ["Data Science", "Econ"], prereqs: [], type: "major_prereq"
  },
  {
    name: "ECON 100A",    units: 4, weekly_hours: 10, exam_count: 3,
    gpa: 3.3, risk: 0.5, progress: 1.0, quality: 0.68,
    paths: ["Econ"], prereqs: ["ECON 1"], type: "major_core"
  },
  {
    name: "DATA 8",       units: 4, weekly_hours: 9,  exam_count: 2,
    gpa: 3.5, risk: 0.35, progress: 0.8, quality: 0.85,
    paths: ["Data Science", "Econ"], prereqs: [], type: "major_prereq"
  },
  {
    name: "HISTORY 7A",   units: 4, weekly_hours: 5,  exam_count: 2,
    gpa: 3.7, risk: 0.15, progress: 0.5, quality: 0.80,
    paths: ["Breadth"], prereqs: [], type: "breadth"
  },
  {
    name: "PHILOS 3",     units: 4, weekly_hours: 4,  exam_count: 2,
    gpa: 3.8, risk: 0.10, progress: 0.3, quality: 0.82,
    paths: ["Breadth"], prereqs: [], type: "elective"
  },
  {
    name: "CS 61A",       units: 4, weekly_hours: 12, exam_count: 4,
    gpa: 3.2, risk: 0.6,  progress: 1.0, quality: 0.90,
    paths: ["Data Science", "CS"], prereqs: [], type: "major_core"
  },
  {
    name: "ECON 1",       units: 4, weekly_hours: 6,  exam_count: 2,
    gpa: 3.5, risk: 0.25, progress: 0.8, quality: 0.74,
    paths: ["Econ", "Haas"], prereqs: [], type: "major_prereq"
  },
  {
    name: "MATH 1A",      units: 4, weekly_hours: 8,  exam_count: 3,
    gpa: 3.3, risk: 0.45, progress: 0.8, quality: 0.70,
    paths: ["Data Science", "Econ", "CS"], prereqs: [], type: "major_prereq"
  }
];

// All known paths for optionality calculation
const ALL_PATHS = ["Haas", "Business", "Econ", "Data Science", "CS", "Breadth"];

// ── Step 1: Preference → Raw Score ───────────────────────────
// Matches formula doc: user answer → raw score (1–5 scale)

function prefToRawScore(dimension, answer) {
  const maps = {
    gpa: { "High": 5, "Medium": 3, "Low": 1 },
    // Workload is REVERSED: caring about light workload → high score
    workload: { "Light": 5, "Moderate": 3, "Heavy": 1 },
    // Risk is REVERSED: not comfortable with risk → high score
    risk: { "Low": 5, "Medium": 3, "High": 1 },
    progress: { "High": 5, "Medium": 3, "Low": 1 }
  };
  return (maps[dimension] && maps[dimension][answer]) || 3;
}

// ── Step 2 & 3: Raw Score → Squared → Normalized Weights ─────
// Formula: value_i = raw^2, weight_i = value_i / Σ(value_i)

function getWeights(gpaPref, workloadPref, riskPref, progressPref) {
  const raw = {
    gpa:      prefToRawScore("gpa",      gpaPref),
    workload: prefToRawScore("workload", workloadPref),
    risk:     prefToRawScore("risk",     riskPref),
    progress: prefToRawScore("progress", progressPref)
  };
  // Square to amplify differences
  const sq = {};
  for (const k in raw) sq[k] = raw[k] * raw[k];
  const total = Object.values(sq).reduce((a, b) => a + b, 0);
  const w = {};
  for (const k in sq) w[k] = sq[k] / total;
  return w;
}

// ── Course-level Workload ─────────────────────────────────────
// Formula: course_workload = weekly_hours × exam_factor
// exam_factor = 1 + 0.1 × (exam_count - 2)

function courseWorkload(course) {
  const examFactor = 1 + 0.1 * (course.exam_count - 2);
  return course.weekly_hours * examFactor;
}

// ── Plan-level metric calculations ───────────────────────────
// GPA: Σ(gpa_i × units_i) / Σ(units_i)
function planGPA(courses) {
  const totalUnits = courses.reduce((s, c) => s + c.units, 0);
  return courses.reduce((s, c) => s + c.gpa * c.units, 0) / totalUnits;
}

// Workload: Σ(course_workload_i)
function planWorkload(courses) {
  return courses.reduce((s, c) => s + courseWorkload(c), 0);
}

// Progress: Σ(progress_i × units_i) / Σ(units_i)
function planProgress(courses) {
  const totalUnits = courses.reduce((s, c) => s + c.units, 0);
  return courses.reduce((s, c) => s + c.progress * c.units, 0) / totalUnits;
}

// Feasibility (inverse of risk): Σ((1-risk_i) × units_i) / Σ(units_i)
function planFeasibility(courses) {
  const totalUnits = courses.reduce((s, c) => s + c.units, 0);
  return courses.reduce((s, c) => s + (1 - c.risk) * c.units, 0) / totalUnits;
}

// ── Cross-plan Normalization ──────────────────────────────────
// GPA_score    = (planGPA - min) / (max - min)         [maximize]
// Workload_score = 1 - (planWL - min) / (max - min)    [minimize → invert]
// Progress_score = (planProg - min) / (max - min)      [maximize]
// Risk_score   = (planFeas - min) / (max - min)        [already inverted above]

function normalize(value, min, max) {
  if (max === min) return 0.5; // avoid divide-by-zero if all plans equal
  return (value - min) / (max - min);
}

// ── Strategy: infer recommended plan ─────────────────────────
function inferStrategy(gpaPref, workloadPref, riskPref, progressPref, goals) {
  if (riskPref === "Low" && gpaPref === "High") return "Conservative";
  if (progressPref === "High" || (goals && goals.includes("Complete major"))) return "Balanced";
  if (goals && goals.includes("Explore interests")) return "Hedged";
  if (workloadPref === "Light") return "Conservative";
  return "Balanced";
}

// ── Plan Generation per strategy ─────────────────────────────
// Filter by prerequisites (simple: check against completedCourses)
// Then sort by strategy priority and pick top courses within unit limit

function generatePlan(strategy, completedCourses, maxUnits) {
  maxUnits = maxUnits || 17;
  const completed = completedCourses || [];

  // Filter out courses whose prereqs aren't met
  const eligible = COURSES.filter(c =>
    c.prereqs.every(p => completed.includes(p))
  );

  let sorted;
  if (strategy === "Conservative") {
    // Prioritise: low risk first, then high GPA
    sorted = [...eligible].sort((a, b) =>
      a.risk !== b.risk ? a.risk - b.risk : b.gpa - a.gpa
    );
  } else if (strategy === "Hedged") {
    // Prioritise: cross-path diversity, then by number of paths covered
    sorted = [...eligible].sort((a, b) => b.paths.length - a.paths.length || a.risk - b.risk);
  } else {
    // Balanced: sort by composite (gpa + feasibility - risk)
    sorted = [...eligible].sort((a, b) =>
      (b.gpa + (1 - b.risk)) - (a.gpa + (1 - a.risk))
    );
  }

  // Greedily pick courses up to unit limit, no duplicates
  const plan = [];
  let usedUnits = 0;
  for (const c of sorted) {
    if (usedUnits + c.units <= maxUnits) {
      plan.push(c);
      usedUnits += c.units;
    }
    if (plan.length >= 4) break; // cap at 4 courses for clarity
  }
  return plan;
}

// ── Full Evaluation (with cross-plan normalization) ──────────
// Takes all 3 plans at once so we can normalize across them

function evaluateAllPlans(plans, weights) {
  // 1. Compute raw plan-level metrics
  const rawGPA      = plans.map(planGPA);
  const rawWorkload = plans.map(planWorkload);
  const rawProgress = plans.map(planProgress);
  const rawFeas     = plans.map(planFeasibility);

  // 2. Find min/max across plans
  const minMax = (arr) => ({ min: Math.min(...arr), max: Math.max(...arr) });
  const mmGPA  = minMax(rawGPA);
  const mmWL   = minMax(rawWorkload);
  const mmProg = minMax(rawProgress);
  const mmFeas = minMax(rawFeas);

  // 3. Normalize + score each plan
  return plans.map((plan, i) => {
    const gpaScore      = normalize(rawGPA[i],      mmGPA.min,  mmGPA.max);
    const workloadScore = 1 - normalize(rawWorkload[i], mmWL.min, mmWL.max); // invert: lower is better
    const progressScore = normalize(rawProgress[i], mmProg.min, mmProg.max);
    const riskScore     = normalize(rawFeas[i],     mmFeas.min, mmFeas.max);

    const total =
      weights.gpa      * gpaScore +
      weights.workload * workloadScore +
      weights.progress * progressScore +
      weights.risk     * riskScore;

    return {
      gpaScore:      +gpaScore.toFixed(3),
      workloadScore: +workloadScore.toFixed(3),
      progressScore: +progressScore.toFixed(3),
      riskScore:     +riskScore.toFixed(3),
      total:         +total.toFixed(3),
      rawGPA:        +rawGPA[i].toFixed(2),
      rawWorkload:   +rawWorkload[i].toFixed(1),
      rawProgress:   +rawProgress[i].toFixed(2),
      rawFeas:       +rawFeas[i].toFixed(2)
    };
  });
}

// ── Template trade-off explanation ───────────────────────────
function generateExplanation(strategy, scores, weights) {
  const { gpaScore, workloadScore, progressScore, riskScore } = scores;

  const strongest = Object.entries({ gpaScore, workloadScore, progressScore, riskScore })
    .sort((a, b) => b[1] - a[1])[0][0];
  const weakest = Object.entries({ gpaScore, workloadScore, progressScore, riskScore })
    .sort((a, b) => a[1] - b[1])[0][0];

  const label = {
    gpaScore: "GPA stability", workloadScore: "light workload",
    progressScore: "degree progress", riskScore: "enrollment safety"
  };

  let explanation = "";
  if (strategy === "Conservative") {
    explanation = `This plan prioritises ${label[strongest]} and reduces uncertainty. ` +
      `Courses were selected for high enrollment availability and historically strong grades. ` +
      (workloadScore < 0.4 ? "The trade-off is a heavier workload than other options." :
       progressScore < 0.4 ? "It covers fewer major requirements, leaving more flexibility later." : "It's a stable, predictable semester.");
  } else if (strategy === "Balanced") {
    explanation = `This plan balances across all four dimensions. ` +
      `It scores well on ${label[strongest]} while keeping ${label[weakest]} at an acceptable level. ` +
      "A solid choice if you don't want to over-optimise for any single goal.";
  } else {
    explanation = `This plan maximises ${label[strongest]} by including courses across multiple academic paths. ` +
      `It keeps future options open but comes with higher enrollment uncertainty. ` +
      "Best suited if you're still exploring your direction.";
  }
  return explanation;
}

function generateRiskAlert(plan, strategy) {
  const highRisk = plan.filter(c => c.risk > 0.45);
  if (highRisk.length === 0) {
    return "All courses in this plan have historically low enrollment competition.";
  }
  const names = highRisk.map(c => c.name).join(", ");
  return `${names} ${highRisk.length > 1 ? "have" : "has"} a long waitlist history. Enroll early and have a backup ready.`;
}
