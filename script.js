// ============================================================
// CourseWise — script.js  (v2 — Recommendation Engine)
// Architecture: Search (combo generation) + Ranking + Strategy
// ============================================================

const DATA_FILES = {
  courses:      "data/courses.csv",
  sections:     "data/sections.csv",
  metrics:      "data/course_metrics.csv",
  requirements: "data/requirement_mapping.csv"
};

// ── Strategy labels ──────────────────────────────────────────
// Conservative = min risk combo
// Balanced     = max weighted score combo
// Ambitious    = max progress (degree coverage) combo
const STRATEGIES = ["Conservative", "Balanced", "Ambitious"];

const APP_STATE = { loaded: false, data: null };

// ── CSV parser ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ── Major → path mapping ─────────────────────────────────────
function titleToPathName(majorLabel) {
  const maps = {
    "Business Administration (Haas)": "Haas",
    "Economics":           "Econ",
    "Data Science":        "Data",
    "Computer Science":    "CS",
    "Statistics":          "Data",
    "Applied Mathematics": "Data",
    "Undeclared / Exploring": "Exploring"
  };
  return maps[majorLabel] || majorLabel;
}

// ── Requirement type → progress weight ───────────────────────
// Mirrors the doc: core > required > elective
// Maps the actual CSV values in requirement_mapping.csv
function reqTypeToWeight(reqType) {
  const map = {
    core:     1.0,
    advanced: 0.85,
    prereq:   0.70,
    req:      0.60,
    breadth:  0.45,
    support:  0.35,
    elective: 0.20
  };
  return map[String(reqType).toLowerCase()] ?? 0.20;
}

// ── Data loading ─────────────────────────────────────────────
async function loadData() {
  if (APP_STATE.loaded) return APP_STATE.data;

  const [coursesText, sectionsText, metricsText, requirementsText] = await Promise.all([
    fetch(DATA_FILES.courses).then(r => r.text()),
    fetch(DATA_FILES.sections).then(r => r.text()),
    fetch(DATA_FILES.metrics).then(r => r.text()),
    fetch(DATA_FILES.requirements).then(r => r.text())
  ]);

  const coursesRows      = parseCSV(coursesText);
  const sectionsRows     = parseCSV(sectionsText);
  const metricsRows      = parseCSV(metricsText);
  const requirementsRows = parseCSV(requirementsText);

  // Index lookups
  const metricsByCourseId = Object.fromEntries(
    metricsRows.map(row => [String(row.course_id), row])
  );

  const sectionsByCourseId = {};
  sectionsRows.forEach(row => {
    const key = String(row.course_id);
    if (!sectionsByCourseId[key]) sectionsByCourseId[key] = [];
    sectionsByCourseId[key].push(row);
  });

  // requirements keyed by course_id: array of { path, requirement_type, importance }
  const requirementsByCourseId = {};
  requirementsRows.forEach(row => {
    const key = String(row.course_id);
    if (!requirementsByCourseId[key]) requirementsByCourseId[key] = [];
    requirementsByCourseId[key].push(row);
  });

  const courses = coursesRows.map(row => {
    const courseId = String(row.course_id);
    const metric   = metricsByCourseId[courseId] || {};
    const section  = (sectionsByCourseId[courseId] || [])[0] || {};
    const reqs     = requirementsByCourseId[courseId] || [];

    // Enrollment risk: weighted fill rate + waitlist pressure
    const fillRate     = section.capacity ? toNumber(section.enrolled) / toNumber(section.capacity) : 0;
    const waitlistRatio = section.capacity ? toNumber(section.waitlist) / toNumber(section.capacity) : 0;
    const risk = clamp01((0.6 * fillRate) + (0.4 * Math.min(waitlistRatio, 1)));

    // Progress contribution: highest requirement_type weight among all paths
    // This correctly treats the type as a course×major relationship (not a course property)
    const reqWeight = reqs.length
      ? Math.max(...reqs.map(r => reqTypeToWeight(r.requirement_type)))
      : 0.20; // unrecognised course = elective level

    return {
      courseId,
      name:         row.course_code,
      title:        row.title,
      units:        toNumber(row.units, 0),
      department:   row.department,
      gpa:          toNumber(metric.avg_gpa, 3.3),
      weeklyHours:  toNumber(metric.weekly_hours, 6),
      examCount:    toNumber(metric.exam_count, 2),
      risk,
      reqWeight,    // used in combo progress calculation
      paths:        [...new Set(reqs.map(r => r.path).filter(Boolean))],
      requirementTypes: [...new Set(reqs.map(r => r.requirement_type).filter(Boolean))],
      prereqs: [],
      sections: (sectionsByCourseId[courseId] || []).map(sec => ({
        days:       sec.days,
        start:      sec.start_time,
        end:        sec.end_time,
        instructor: sec.instructor,
        capacity:   toNumber(sec.capacity, 0),
        enrolled:   toNumber(sec.enrolled, 0),
        waitlist:   toNumber(sec.waitlist, 0)
      }))
    };
  });

  const data = { courses, requirementsRows, sectionsRows };
  APP_STATE.loaded = true;
  APP_STATE.data   = data;
  return data;
}

function getCourseNames() {
  if (!APP_STATE.data) return [];
  return APP_STATE.data.courses.map(c => c.name);
}

// ── Schedule conflict detection ──────────────────────────────
function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function expandDays(days) {
  if (days === "MWF")   return ["M", "W", "F"];
  if (days === "TuTh")  return ["Tu", "Th"];
  return [days];
}

function sectionsConflict(a, b) {
  for (const sa of a.sections || []) {
    for (const sb of b.sections || []) {
      const sharedDay = expandDays(sa.days).some(d => expandDays(sb.days).includes(d));
      if (!sharedDay) continue;
      if (timeToMinutes(sa.start) < timeToMinutes(sb.end) &&
          timeToMinutes(sb.start) < timeToMinutes(sa.end)) return true;
    }
  }
  return false;
}

function hasConflict(combo, candidate) {
  return combo.some(c => sectionsConflict(c, candidate));
}

// ── Combo metrics ────────────────────────────────────────────
function comboUnits(courses) {
  return courses.reduce((s, c) => s + c.units, 0);
}

function comboGPA(courses) {
  const units = comboUnits(courses);
  if (!units) return 0;
  return courses.reduce((s, c) => s + c.gpa * c.units, 0) / units;
}

function comboWorkload(courses) {
  // weeklyHours adjusted for exam intensity
  return courses.reduce((s, c) => s + c.weeklyHours * (1 + 0.1 * (c.examCount - 2)), 0);
}

// Progress = unit-weighted average of reqWeight across combo
// Higher reqWeight = course matters more for degree requirements (core > required > elective)
function comboProgress(courses) {
  const units = comboUnits(courses);
  if (!units) return 0;
  return courses.reduce((s, c) => s + c.reqWeight * c.units, 0) / units;
}

function comboRisk(courses) {
  const units = comboUnits(courses);
  if (!units) return 0;
  return courses.reduce((s, c) => s + c.risk * c.units, 0) / units;
}

// Checks if combo has at least 1 core or required course for the target paths
function hasCoreOrRequired(combo, targetPaths) {
  return combo.some(c =>
    c.requirementTypes.some(t => t === "core" || t === "req" || t === "prereq") &&
    (targetPaths.length === 0 || c.paths.some(p => targetPaths.includes(p)))
  );
}

// ── Step 1: Build candidate pool ─────────────────────────────
// Filter out completed, filter by prereqs, prioritise target-path courses
function buildPool(courses, completedIds, targetPaths) {
  const completed = new Set(completedIds || []);
  return courses.filter(c => {
    if (completed.has(c.name)) return false;         // already done
    if (c.prereqs.some(pr => !completed.has(pr))) return false; // prereq not met
    return true;
  });
}

// ── Step 2: Generate N candidate combos ─────────────────────
// Strategy: greedy-random — sort by a shuffled priority score, then greedily fill.
// Run COMBO_COUNT times with different shuffles to explore the space.
const COMBO_COUNT = 60;
const MIN_COURSES = 3;
const MAX_COURSES = 4;

function generateCombinations(pool, maxUnits, targetPaths) {
  const combos = [];
  const seen   = new Set(); // dedup by sorted courseId string

  // Helper: attempt one greedy build with a given sort seed
  function buildOne(sorted) {
    const combo = [];
    let units = 0;

    // PRIORITY: ensure at least one core/required course gets in first
    const coreFirst = sorted.filter(c =>
      c.requirementTypes.some(t => t === "core" || t === "req") &&
      (targetPaths.length === 0 || c.paths.some(p => targetPaths.includes(p)))
    );
    const rest = sorted.filter(c => !coreFirst.includes(c));
    const order = [...coreFirst.slice(0, 1), ...rest]; // at most 1 core anchor

    for (const c of order) {
      if (combo.length >= MAX_COURSES) break;
      if (units + c.units > maxUnits) continue;
      if (hasConflict(combo, c)) continue;
      combo.push(c);
      units += c.units;
    }

    if (combo.length < MIN_COURSES) return null;
    const key = combo.map(c => c.courseId).sort().join(",");
    if (seen.has(key)) return null;
    seen.add(key);
    return combo;
  }

  // Greedy pass 1: sort by reqWeight desc (core-first, path-aware)
  {
    const sorted = [...pool].sort((a, b) => {
      const aPath = targetPaths.length === 0 || a.paths.some(p => targetPaths.includes(p)) ? 1 : 0;
      const bPath = targetPaths.length === 0 || b.paths.some(p => targetPaths.includes(p)) ? 1 : 0;
      if (bPath !== aPath) return bPath - aPath;
      return b.reqWeight - a.reqWeight;
    });
    const combo = buildOne(sorted);
    if (combo) combos.push(combo);
  }

  // Random passes: shuffle with jitter to explore diverse combos
  for (let i = 0; i < COMBO_COUNT - 1; i++) {
    const sorted = [...pool].sort(() => Math.random() - 0.5 + (Math.random() * 0.3 - 0.15));
    const combo = buildOne(sorted);
    if (combo) combos.push(combo);
  }

  return combos;
}

// ── Step 3: Score each combo ─────────────────────────────────
const GPA_RANGE      = { min: 2.7, max: 4.0 };
const WORKLOAD_RANGE = { min: 12,  max: 48  };

function scaleGPA(v) {
  return clamp01((v - GPA_RANGE.min) / (GPA_RANGE.max - GPA_RANGE.min));
}
function scaleWorkload(v) {
  // invert: lower workload = higher score
  return clamp01(1 - (v - WORKLOAD_RANGE.min) / (WORKLOAD_RANGE.max - WORKLOAD_RANGE.min));
}

function scoreCombo(combo, weights) {
  const gpa      = comboGPA(combo);
  const workload = comboWorkload(combo);
  const progress = comboProgress(combo);
  const risk     = comboRisk(combo);

  const gpaScore      = scaleGPA(gpa);
  const workloadScore = scaleWorkload(workload);
  const progressScore = clamp01(progress);
  const riskScore     = clamp01(1 - risk); // lower risk = higher score

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
    rawGPA:        +gpa.toFixed(2),
    rawWorkload:   +workload.toFixed(1),
    rawProgress:   +progress.toFixed(2),
    rawRisk:       +risk.toFixed(2),
    units:         comboUnits(combo)
  };
}

// ── Step 4 & 5: Rank combos ──────────────────────────────────
function rankCombos(combos, weights) {
  return combos
    .map(combo => ({ combo, scores: scoreCombo(combo, weights) }))
    .sort((a, b) => b.scores.total - a.scores.total);
}

// ── Step 6: Pick strategy plans (dynamic, not fixed templates) ──
// Conservative → combo with lowest average risk
// Balanced     → combo with highest weighted score
// Ambitious    → combo with highest progress score (most degree coverage)
function pickStrategies(ranked) {
  if (!ranked.length) return { Conservative: null, Balanced: null, Ambitious: null };

  const balanced = ranked[0]; // highest total score

  const conservative = ranked.reduce((best, item) =>
    item.scores.rawRisk < best.scores.rawRisk ? item : best
  );

  const ambitious = ranked.reduce((best, item) =>
    item.scores.progressScore > best.scores.progressScore ? item : best
  );

  return { Conservative: conservative, Balanced: balanced, Ambitious: ambitious };
}

// ── Main entry: recommend() ──────────────────────────────────
function generateAllPlans(prefs, courses) {
  const targetPaths = (prefs.majors || [])
    .map(titleToPathName)
    .filter(p => p !== "Exploring");

  const pool   = buildPool(courses, prefs.completed || [], targetPaths);
  const combos = generateCombinations(pool, prefs.maxUnits || 17, targetPaths);

  if (!combos.length) {
    // fallback: return first 4 eligible courses as a single plan for all strategies
    const fallback = pool.slice(0, 4);
    return STRATEGIES.map(() => fallback);
  }

  const weights = resolveWeightsFromPrefs(prefs);
  const ranked  = rankCombos(combos, weights);
  const plans   = pickStrategies(ranked);

  return STRATEGIES.map(s => plans[s]?.combo || ranked[0].combo);
}

// ── Weights ──────────────────────────────────────────────────
// Weights = user preferences (priority), not trade-offs
function resolveWeightsFromPrefs(prefs) {
  // If sliderWeights passed in (from input.html), normalise directly
  if (prefs.sliderWeights) {
    const raw = {
      gpa:      Number(prefs.sliderWeights.gpa)      || 0,
      workload: Number(prefs.sliderWeights.workload) || 0,
      risk:     Number(prefs.sliderWeights.risk)     || 0,
      progress: Number(prefs.sliderWeights.progress) || 0
    };
    const total = Object.values(raw).reduce((s, v) => s + v, 0);
    if (total > 0) {
      return {
        gpa:      raw.gpa      / total,
        workload: raw.workload / total,
        risk:     raw.risk     / total,
        progress: raw.progress / total
      };
    }
  }
  // Fallback: equal weights
  return { gpa: 0.25, workload: 0.25, risk: 0.25, progress: 0.25 };
}

// Kept for backwards compatibility (results.html calls resolveWeights)
function resolveWeights(prefs) {
  return resolveWeightsFromPrefs(prefs);
}

// ── Score all plans (for results page display) ────────────────
function evaluateAllPlans(plans, weights) {
  return plans.map(plan => scoreCombo(plan, weights));
}

// ── UI helpers ───────────────────────────────────────────────
function strongestWeakest(scores) {
  const dims = [
    ["GPA",                 scores.gpaScore],
    ["Workload",            scores.workloadScore],
    ["Enrollment feasibility", scores.riskScore],
    ["Progress",            scores.progressScore]
  ];
  const strongest = [...dims].sort((a, b) => b[1] - a[1])[0];
  const weakest   = [...dims].sort((a, b) => a[1] - b[1])[0];
  return { strongest, weakest };
}

function generateExplanation(strategy, scores, plan, prefs) {
  const { strongest, weakest } = strongestWeakest(scores);
  const names     = plan.map(c => c.name).join(", ");
  const majorText = (prefs.majors?.length) ? prefs.majors.join(" + ") : "your priorities";

  if (strategy === "Conservative") {
    return `Lowest enrollment risk of the three plans. Built around ${names} — courses with lighter waitlist pressure and more predictable availability. Prioritises stability for ${majorText}. Strong on ${strongest[0].toLowerCase()}, softer on ${weakest[0].toLowerCase()}.`;
  }
  if (strategy === "Ambitious") {
    return `Highest degree progress of the three plans. Anchored by courses like ${names} that count directly toward ${majorText} requirements. Moves faster on coverage — the trade-off is higher ${weakest[0].toLowerCase()} pressure.`;
  }
  return `Best overall score across all four priorities. Mixes ${names} to avoid sharp weaknesses in any single dimension. Its main strength is ${strongest[0].toLowerCase()}; it gives up a little on ${weakest[0].toLowerCase()} to stay balanced.`;
}

function generateRiskAlert(plan) {
  const risky = plan.filter(c => c.risk >= 0.75);
  if (!risky.length) return null;
  const names = risky.map(c => c.name).join(", ");
  return `${names} ${risky.length > 1 ? "have" : "has"} high enrollment pressure based on fill and waitlist data. Have a backup option ready.`;
}
