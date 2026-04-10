// ============================================================
// CourseWise — script.js
// MVP logic aligned with project docs
// ============================================================

const DATA_FILES = {
  courses: "data/courses.csv",
  sections: "data/sections.csv",
  metrics: "data/course_metrics.csv",
  requirements: "data/requirement_mapping.csv"
};

const STRATEGIES = ["Conservative", "Balanced", "Hedged"];

const APP_STATE = {
  loaded: false,
  data: null
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function titleToPathName(majorLabel) {
  const maps = {
    "Business Administration (Haas)": "Haas",
    "Economics": "Econ",
    "Data Science": "Data",
    "Computer Science": "CS",
    "Statistics": "Data",
    "Applied Mathematics": "Data",
    "Undeclared / Exploring": "Exploring"
  };
  return maps[majorLabel] || majorLabel;
}

function importanceToProgress(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const maps = {
    core: 1.0,
    advanced: 1.0,
    prereq: 0.8,
    req: 0.5,
    breadth: 0.5,
    support: 0.5,
    elective: 0.3
  };
  return maps[String(value).toLowerCase()] ?? 0.3;
}

async function loadData() {
  if (APP_STATE.loaded) return APP_STATE.data;

  const [coursesText, sectionsText, metricsText, requirementsText] = await Promise.all([
    fetch(DATA_FILES.courses).then(r => r.text()),
    fetch(DATA_FILES.sections).then(r => r.text()),
    fetch(DATA_FILES.metrics).then(r => r.text()),
    fetch(DATA_FILES.requirements).then(r => r.text())
  ]);

  const coursesRows = parseCSV(coursesText);
  const sectionsRows = parseCSV(sectionsText);
  const metricsRows = parseCSV(metricsText);
  const requirementsRows = parseCSV(requirementsText);

  const metricsByCourseId = Object.fromEntries(
    metricsRows.map(row => [String(row.course_id), row])
  );

  const sectionsByCourseId = {};
  sectionsRows.forEach(row => {
    const key = String(row.course_id);
    if (!sectionsByCourseId[key]) sectionsByCourseId[key] = [];
    sectionsByCourseId[key].push(row);
  });

  const requirementsByCourseId = {};
  requirementsRows.forEach(row => {
    const key = String(row.course_id);
    if (!requirementsByCourseId[key]) requirementsByCourseId[key] = [];
    requirementsByCourseId[key].push(row);
  });

  const courses = coursesRows.map(row => {
    const courseId = String(row.course_id);
    const metric = metricsByCourseId[courseId] || {};
    const section = (sectionsByCourseId[courseId] || [])[0] || {};
    const requirements = requirementsByCourseId[courseId] || [];
    const fillRate = section.capacity ? toNumber(section.enrolled) / toNumber(section.capacity) : 0;
    const waitlistRatio = section.capacity ? toNumber(section.waitlist) / toNumber(section.capacity) : 0;
    const risk = (0.6 * fillRate) + (0.4 * Math.min(waitlistRatio, 1));

    return {
      courseId,
      name: row.course_code,
      title: row.title,
      units: toNumber(row.units, 0),
      department: row.department,
      gpa: toNumber(metric.avg_gpa, 3.3),
      weeklyHours: toNumber(metric.weekly_hours, 6),
      examCount: toNumber(metric.exam_count, 2),
      risk,
      progress: requirements.length
        ? Math.max(...requirements.map(r => importanceToProgress(r.importance || r.requirement_type)))
        : 0.3,
      paths: [...new Set(requirements.map(r => r.path).filter(Boolean))],
      requirementTypes: [...new Set(requirements.map(r => r.requirement_type).filter(Boolean))],
      prereqs: [],
      sections: (sectionsByCourseId[courseId] || []).map(sec => ({
        days: sec.days,
        start: sec.start_time,
        end: sec.end_time,
        instructor: sec.instructor,
        capacity: toNumber(sec.capacity, 0),
        enrolled: toNumber(sec.enrolled, 0),
        waitlist: toNumber(sec.waitlist, 0)
      }))
    };
  });

  const data = { courses, requirementsRows, sectionsRows };
  APP_STATE.loaded = true;
  APP_STATE.data = data;
  return data;
}

function getCourseNames() {
  if (!APP_STATE.data) return [];
  return APP_STATE.data.courses.map(c => c.name);
}

function courseWorkload(course) {
  return course.weeklyHours * (1 + 0.1 * (course.examCount - 2));
}

function planUnits(courses) {
  return courses.reduce((sum, c) => sum + c.units, 0);
}

function planGPA(courses) {
  const units = planUnits(courses);
  if (!units) return 0;
  return courses.reduce((sum, c) => sum + (c.gpa * c.units), 0) / units;
}

function planWorkload(courses) {
  return courses.reduce((sum, c) => sum + courseWorkload(c), 0);
}

function planProgress(courses) {
  const units = planUnits(courses);
  if (!units) return 0;
  return courses.reduce((sum, c) => sum + (c.progress * c.units), 0) / units;
}

function planFeasibility(courses) {
  const units = planUnits(courses);
  if (!units) return 0;
  return courses.reduce((sum, c) => sum + ((1 - c.risk) * c.units), 0) / units;
}

function normalize(value, min, max) {
  if (Math.abs(max - min) < 0.0001) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function evaluateAllPlans(plans, weights) {
  const rawGPA = plans.map(planGPA);
  const rawWorkload = plans.map(planWorkload);
  const rawProgress = plans.map(planProgress);
  const rawFeasibility = plans.map(planFeasibility);

  const minMax = values => ({ min: Math.min(...values), max: Math.max(...values) });
  const mmGPA = minMax(rawGPA);
  const mmWorkload = minMax(rawWorkload);
  const mmProgress = minMax(rawProgress);
  const mmFeasibility = minMax(rawFeasibility);

  return plans.map((plan, index) => {
    const gpaScore = normalize(rawGPA[index], mmGPA.min, mmGPA.max);
    const workloadScore = 1 - normalize(rawWorkload[index], mmWorkload.min, mmWorkload.max);
    const progressScore = normalize(rawProgress[index], mmProgress.min, mmProgress.max);
    const riskScore = normalize(rawFeasibility[index], mmFeasibility.min, mmFeasibility.max);

    return {
      gpaScore: +gpaScore.toFixed(3),
      workloadScore: +workloadScore.toFixed(3),
      progressScore: +progressScore.toFixed(3),
      riskScore: +riskScore.toFixed(3),
      total: +(weights.gpa * gpaScore +
        weights.workload * workloadScore +
        weights.progress * progressScore +
        weights.risk * riskScore).toFixed(3),
      rawGPA: +rawGPA[index].toFixed(2),
      rawWorkload: +rawWorkload[index].toFixed(1),
      rawProgress: +rawProgress[index].toFixed(2),
      rawFeasibility: +rawFeasibility[index].toFixed(2),
      units: planUnits(plan)
    };
  });
}

function prefToRawScore(dim, answer) {
  const maps = {
    gpa: { High: 5, Medium: 3, Low: 1 },
    workload: { Light: 5, Moderate: 3, Heavy: 1 },
    risk: { Low: 5, Medium: 3, High: 1 },
    progress: { High: 5, Medium: 3, Low: 1 }
  };
  return (maps[dim] && maps[dim][answer]) || 3;
}

function getWeights(gpaPref, workloadPref, riskPref, progressPref) {
  const raw = {
    gpa: prefToRawScore("gpa", gpaPref),
    workload: prefToRawScore("workload", workloadPref),
    risk: prefToRawScore("risk", riskPref),
    progress: prefToRawScore("progress", progressPref)
  };

  const squared = {};
  Object.keys(raw).forEach(key => {
    squared[key] = raw[key] * raw[key];
  });

  const total = Object.values(squared).reduce((sum, value) => sum + value, 0);
  const weights = {};
  Object.keys(squared).forEach(key => {
    weights[key] = squared[key] / total;
  });
  return weights;
}

function inferStrategy(gpaPref, workloadPref, riskPref, progressPref, goals) {
  if (goals && goals.includes("Explore interests")) return "Hedged";
  if (riskPref === "Low" || workloadPref === "Light" || gpaPref === "High") return "Conservative";
  if (progressPref === "High" || (goals && goals.includes("Complete major"))) return "Balanced";
  return "Balanced";
}

function timeToMinutes(timeStr) {
  const [hour, minute] = String(timeStr).split(":").map(Number);
  return (hour * 60) + minute;
}

function expandDays(days) {
  if (days === "MWF") return ["M", "W", "F"];
  if (days === "TuTh") return ["Tu", "Th"];
  return [days];
}

function sectionsConflict(courseA, courseB) {
  for (const a of courseA.sections || []) {
    for (const b of courseB.sections || []) {
      const daysA = expandDays(a.days);
      const daysB = expandDays(b.days);
      const overlapDay = daysA.some(day => daysB.includes(day));
      if (!overlapDay) continue;

      const aStart = timeToMinutes(a.start);
      const aEnd = timeToMinutes(a.end);
      const bStart = timeToMinutes(b.start);
      const bEnd = timeToMinutes(b.end);

      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }
  return false;
}

function planHasConflict(plan, candidate) {
  return plan.some(existing => sectionsConflict(existing, candidate));
}

function coversAtLeastTwoTargetPaths(plan, targetPaths) {
  const relevant = new Set();
  plan.forEach(course => {
    course.paths.forEach(path => {
      if (targetPaths.includes(path)) relevant.add(path);
    });
  });
  return relevant.size >= 2;
}

function strategySort(strategy, courses, preferredPaths) {
  const targetPaths = preferredPaths.length ? preferredPaths : [];
  const scoreForCourse = course => {
    const pathCoverage = course.paths.filter(path => targetPaths.includes(path)).length;
    if (strategy === "Conservative") {
      return (1 - course.risk) * 3 + course.gpa * 1.8 + course.progress;
    }
    if (strategy === "Hedged") {
      return pathCoverage * 3 + course.paths.length * 2 + course.progress - course.risk;
    }
    return course.progress * 2 + course.gpa + (1 - course.risk) + pathCoverage;
  };

  return [...courses].sort((a, b) => scoreForCourse(b) - scoreForCourse(a));
}

function generatePlan(strategy, context) {
  const { courses, completedCourses, maxUnits, preferredPaths } = context;
  const completed = new Set(completedCourses || []);
  const eligible = courses.filter(course => course.prereqs.every(pr => completed.has(pr)));
  const sorted = strategySort(strategy, eligible, preferredPaths);
  const plan = [];
  let units = 0;

  sorted.forEach(course => {
    if (plan.length >= 4) return;
    if (units + course.units > maxUnits) return;
    if (planHasConflict(plan, course)) return;

    if (strategy === "Conservative" && course.risk > 0.7) return;

    plan.push(course);
    units += course.units;
  });

  if (strategy === "Hedged" && preferredPaths.length >= 2 && !coversAtLeastTwoTargetPaths(plan, preferredPaths)) {
    const byPathPriority = sorted.filter(course =>
      course.paths.some(path => preferredPaths.includes(path))
    );

    const rebuilt = [];
    let rebuiltUnits = 0;
    const covered = new Set();

    byPathPriority.forEach(course => {
      if (rebuilt.length >= 4) return;
      if (rebuiltUnits + course.units > maxUnits) return;
      if (planHasConflict(rebuilt, course)) return;

      const addsCoverage = course.paths.some(path => preferredPaths.includes(path) && !covered.has(path));
      if (rebuilt.length < 2 && !addsCoverage) return;

      rebuilt.push(course);
      rebuiltUnits += course.units;
      course.paths.forEach(path => {
        if (preferredPaths.includes(path)) covered.add(path);
      });
    });

    byPathPriority.forEach(course => {
      if (rebuilt.length >= 4) return;
      if (rebuiltUnits + course.units > maxUnits) return;
      if (rebuilt.some(existing => existing.courseId === course.courseId)) return;
      if (planHasConflict(rebuilt, course)) return;
      rebuilt.push(course);
      rebuiltUnits += course.units;
    });

    return rebuilt.length ? rebuilt : plan;
  }

  return plan;
}

function generateAllPlans(prefs, courses) {
  const preferredPaths = (prefs.majors || []).map(titleToPathName).filter(path => path !== "Exploring");
  const context = {
    courses,
    completedCourses: prefs.completed || [],
    maxUnits: prefs.maxUnits || 17,
    preferredPaths
  };

  return STRATEGIES.map(strategy => generatePlan(strategy, context));
}

function strongestWeakest(scores) {
  const dims = [
    ["GPA", scores.gpaScore],
    ["Workload", scores.workloadScore],
    ["Enrollment feasibility", scores.riskScore],
    ["Progress", scores.progressScore]
  ];
  const strongest = [...dims].sort((a, b) => b[1] - a[1])[0];
  const weakest = [...dims].sort((a, b) => a[1] - b[1])[0];
  return { strongest, weakest };
}

function generateExplanation(strategy, scores, plan, prefs) {
  const { strongest, weakest } = strongestWeakest(scores);
  const courseNames = plan.map(course => course.name).join(", ");
  const majorText = (prefs.majors && prefs.majors.length) ? prefs.majors.join(" + ") : "your current goals";

  if (strategy === "Conservative") {
    return `This plan leans toward stability for ${majorText}: it performs best on ${strongest[0].toLowerCase()} and keeps enrollment uncertainty lower by favoring steadier options like ${courseNames}. The trade-off is a weaker ${weakest[0].toLowerCase()} score, so it is safer but less aggressive on exploration or acceleration.`;
  }

  if (strategy === "Hedged") {
    return `This plan is designed to keep multiple paths open for ${majorText}. It uses courses such as ${courseNames} to preserve path coverage while still staying within your unit cap. The upside is stronger ${strongest[0].toLowerCase()}; the cost is lower ${weakest[0].toLowerCase()}, so you are buying flexibility with some efficiency or certainty.`;
  }

  return `This plan aims for the most even trade-off across the four MVP dimensions. It mixes courses like ${courseNames} so no single objective dominates, which is why it tends to avoid sharp weaknesses. Its main strength is ${strongest[0].toLowerCase()}, while ${weakest[0].toLowerCase()} is the dimension it gives up a little to stay balanced overall.`;
}

function generateRiskAlert(plan) {
  const riskyCourses = plan.filter(course => course.risk >= 0.75);
  if (!riskyCourses.length) return null;
  const names = riskyCourses.map(course => course.name).join(", ");
  return `${names} ${riskyCourses.length > 1 ? "have" : "has"} relatively high enrollment pressure based on fill and waitlist data, so keep a backup option ready.`;
}
