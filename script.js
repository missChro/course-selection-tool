// ============================================================
// CourseWise — script.js
// Math matches 选课决策系统项目资料.docx formulas
// ============================================================

const COURSES = [
  { name:"UGBA 10",    units:3, weekly_hours:6,  exam_count:2, gpa:3.6, risk:0.20, progress:0.5, quality:0.78, paths:["Haas","Business"],           prereqs:[],         type:"breadth"     },
  { name:"STAT 20",    units:4, weekly_hours:8,  exam_count:3, gpa:3.4, risk:0.40, progress:0.8, quality:0.72, paths:["Data Science","Econ"],         prereqs:[],         type:"major_prereq"},
  { name:"ECON 100A",  units:4, weekly_hours:10, exam_count:3, gpa:3.3, risk:0.50, progress:1.0, quality:0.68, paths:["Econ"],                        prereqs:["ECON 1"], type:"major_core"  },
  { name:"DATA 8",     units:4, weekly_hours:9,  exam_count:2, gpa:3.5, risk:0.35, progress:0.8, quality:0.85, paths:["Data Science","Econ"],         prereqs:[],         type:"major_prereq"},
  { name:"HISTORY 7A", units:4, weekly_hours:5,  exam_count:2, gpa:3.7, risk:0.15, progress:0.5, quality:0.80, paths:["Breadth"],                     prereqs:[],         type:"breadth"     },
  { name:"PHILOS 3",   units:4, weekly_hours:4,  exam_count:2, gpa:3.8, risk:0.10, progress:0.3, quality:0.82, paths:["Breadth"],                     prereqs:[],         type:"elective"    },
  { name:"CS 61A",     units:4, weekly_hours:12, exam_count:4, gpa:3.2, risk:0.60, progress:1.0, quality:0.90, paths:["Data Science","CS"],           prereqs:[],         type:"major_core"  },
  { name:"ECON 1",     units:4, weekly_hours:6,  exam_count:2, gpa:3.5, risk:0.25, progress:0.8, quality:0.74, paths:["Econ","Haas"],                 prereqs:[],         type:"major_prereq"},
  { name:"MATH 1A",    units:4, weekly_hours:8,  exam_count:3, gpa:3.3, risk:0.45, progress:0.8, quality:0.70, paths:["Data Science","Econ","CS"],    prereqs:[],         type:"major_prereq"},
  { name:"UGBA 104",   units:3, weekly_hours:7,  exam_count:2, gpa:3.5, risk:0.30, progress:0.8, quality:0.76, paths:["Haas","Business"],             prereqs:["UGBA 10"],type:"major_core"  },
  { name:"ECON 140",   units:4, weekly_hours:9,  exam_count:3, gpa:3.2, risk:0.55, progress:1.0, quality:0.65, paths:["Econ"],                        prereqs:["STAT 20"],type:"major_core"  },
  { name:"INFO 159",   units:4, weekly_hours:10, exam_count:2, gpa:3.4, risk:0.45, progress:0.8, quality:0.88, paths:["Data Science","CS"],           prereqs:["DATA 8"], type:"major_core"  }
];

const ALL_PATHS = ["Haas","Business","Econ","Data Science","CS","Breadth"];

// ── Raw score from preference answer ─────────────────────────
function prefToRawScore(dim, answer) {
  const maps = {
    gpa:      { "High":5, "Medium":3, "Low":1 },
    workload: { "Light":5, "Moderate":3, "Heavy":1 },   // reversed
    risk:     { "Low":5, "Medium":3, "High":1 },         // reversed
    progress: { "High":5, "Medium":3, "Low":1 }
  };
  return (maps[dim] && maps[dim][answer]) || 3;
}

// ── Weights: raw → squared → normalized ──────────────────────
function getWeights(gpaPref, workloadPref, riskPref, progressPref) {
  const raw = {
    gpa:      prefToRawScore("gpa",      gpaPref),
    workload: prefToRawScore("workload", workloadPref),
    risk:     prefToRawScore("risk",     riskPref),
    progress: prefToRawScore("progress", progressPref)
  };
  const sq = {};
  for (const k in raw) sq[k] = raw[k] * raw[k];
  const total = Object.values(sq).reduce((a,b) => a+b, 0);
  const w = {};
  for (const k in sq) w[k] = sq[k] / total;
  return w;
}

// ── Course workload: weekly_hours × exam_factor ───────────────
function courseWorkload(c) {
  return c.weekly_hours * (1 + 0.1 * (c.exam_count - 2));
}

// ── Plan-level metrics ────────────────────────────────────────
function planGPA(courses) {
  const tu = courses.reduce((s,c) => s+c.units, 0);
  if (!tu) return 3.0;
  return courses.reduce((s,c) => s + c.gpa*c.units, 0) / tu;
}
function planWorkload(courses) {
  return courses.reduce((s,c) => s + courseWorkload(c), 0);
}
function planProgress(courses) {
  const tu = courses.reduce((s,c) => s+c.units, 0);
  if (!tu) return 0.5;
  return courses.reduce((s,c) => s + c.progress*c.units, 0) / tu;
}
function planFeasibility(courses) {
  const tu = courses.reduce((s,c) => s+c.units, 0);
  if (!tu) return 0.5;
  return courses.reduce((s,c) => s + (1-c.risk)*c.units, 0) / tu;
}

// ── Normalization helper ──────────────────────────────────────
function normalize(v, min, max) {
  if (Math.abs(max - min) < 0.0001) return 0.5;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

// ── Cross-plan normalization & scoring ───────────────────────
function evaluateAllPlans(plans, weights) {
  const rawGPA  = plans.map(planGPA);
  const rawWL   = plans.map(planWorkload);
  const rawProg = plans.map(planProgress);
  const rawFeas = plans.map(planFeasibility);

  const mm = arr => ({ min: Math.min(...arr), max: Math.max(...arr) });
  const mmG = mm(rawGPA), mmW = mm(rawWL), mmP = mm(rawProg), mmF = mm(rawFeas);

  return plans.map((_, i) => {
    // Add small jitter to ensure plans never all land at exact same value
    // (prevents all-zero or all-one scores when plans are similar)
    const jG = i * 0.003, jW = i * 0.004, jP = i * 0.002, jF = i * 0.003;

    const gpaScore      = normalize(rawGPA[i]  + jG, mmG.min, mmG.max);
    const workloadScore = 1 - normalize(rawWL[i] + jW, mmW.min, mmW.max);
    const progressScore = normalize(rawProg[i] + jP, mmP.min, mmP.max);
    const riskScore     = normalize(rawFeas[i] + jF, mmF.min, mmF.max);

    const total = weights.gpa*gpaScore + weights.workload*workloadScore
                + weights.progress*progressScore + weights.risk*riskScore;

    return {
      gpaScore:      +gpaScore.toFixed(3),
      workloadScore: +workloadScore.toFixed(3),
      progressScore: +progressScore.toFixed(3),
      riskScore:     +riskScore.toFixed(3),
      total:         +total.toFixed(3),
      rawGPA:        +rawGPA[i].toFixed(2),
      rawWorkload:   +rawWL[i].toFixed(1),
      rawProgress:   +rawProg[i].toFixed(2),
      rawFeas:       +rawFeas[i].toFixed(2)
    };
  });
}

// ── Strategy inference ────────────────────────────────────────
function inferStrategy(gpaPref, workloadPref, riskPref, progressPref, goals) {
  if (riskPref === "Low" && gpaPref === "High") return "Conservative";
  if (progressPref === "High" || (goals && goals.includes("Complete major"))) return "Balanced";
  if (goals && goals.includes("Explore interests")) return "Hedged";
  if (workloadPref === "Light") return "Conservative";
  return "Balanced";
}

// ── Plan generation ───────────────────────────────────────────
function generatePlan(strategy, completedCourses, maxUnits) {
  maxUnits = maxUnits || 17;
  const completed = completedCourses || [];

  // Filter out courses whose prereqs aren't satisfied
  const eligible = COURSES.filter(c =>
    c.prereqs.every(p => completed.includes(p))
  );

  let sorted;
  if (strategy === "Conservative") {
    // Low risk first, then high GPA
    sorted = [...eligible].sort((a,b) => a.risk !== b.risk ? a.risk-b.risk : b.gpa-a.gpa);
  } else if (strategy === "Hedged") {
    // Maximize path diversity — prefer courses covering multiple or different paths
    // Also include some higher-progress courses to avoid all-zero progress
    sorted = [...eligible].sort((a,b) => {
      const pathScore = b.paths.length - a.paths.length;
      if (pathScore !== 0) return pathScore;
      return b.progress - a.progress; // tiebreak by progress
    });
  } else {
    // Balanced: composite of gpa + feasibility + progress
    sorted = [...eligible].sort((a,b) =>
      (b.gpa + (1-b.risk) + b.progress) - (a.gpa + (1-a.risk) + a.progress)
    );
  }

  // Greedily pick within unit limit, max 4 courses
  const plan = [];
  let used = 0;
  for (const c of sorted) {
    if (used + c.units <= maxUnits) { plan.push(c); used += c.units; }
    if (plan.length >= 4) break;
  }
  return plan;
}

// ── Template trade-off explanation ───────────────────────────
function generateExplanation(strategy, scores) {
  const { gpaScore, workloadScore, progressScore, riskScore } = scores;
  const dims = { gpaScore, workloadScore, progressScore, riskScore };
  const label = { gpaScore:"GPA stability", workloadScore:"manageable workload", progressScore:"degree progress", riskScore:"enrollment safety" };
  const strongest = Object.entries(dims).sort((a,b) => b[1]-a[1])[0][0];
  const weakest   = Object.entries(dims).sort((a,b) => a[1]-b[1])[0][0];

  if (strategy === "Conservative") {
    return `Prioritises ${label[strongest]} — courses selected for low waitlist competition and historically stable grades. Trade-off: ${label[weakest]} scores lower than the other plans.`;
  } else if (strategy === "Balanced") {
    return `Spreads across all four dimensions — strongest on ${label[strongest]} while keeping ${label[weakest]} at an acceptable level. Good if you don't want to over-optimise for any single goal.`;
  } else {
    return `Covers courses across multiple academic paths to keep future options open. Scores highest on ${label[strongest]} but accepts lower ${label[weakest]}. Best if you're still exploring your direction.`;
  }
}

function generateRiskAlert(plan) {
  const highRisk = plan.filter(c => c.risk > 0.45);
  if (!highRisk.length) return null;
  return `${highRisk.map(c=>c.name).join(", ")} ${highRisk.length>1?"have":"has"} a history of high waitlist competition. Enroll early and have a backup course ready.`;
}
