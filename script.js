// ===== Mock Course Data =====
const courses = [
  { name: "UGBA 10", units: 4, workload: 18, gpa: 3.6, risk: 0.2 },
  { name: "STAT 20", units: 4, workload: 20, gpa: 3.4, risk: 0.3 },
  { name: "ECON 100A", units: 4, workload: 25, gpa: 3.3, risk: 0.5 },
  { name: "DATA 8", units: 4, workload: 22, gpa: 3.5, risk: 0.4 },
  { name: "HISTORY 7A", units: 4, workload: 15, gpa: 3.7, risk: 0.2 },
  { name: "PHILOS 3", units: 4, workload: 12, gpa: 3.8, risk: 0.1 }
];


// ===== Strategy Inference =====
function inferStrategy(gpaPriority, workload, risk, goals) {
  if (gpaPriority === "High" && risk === "Low") {
    return "Conservative";
  }

  if (risk === "High" || goals.includes("Explore interests")) {
    return "Hedged";
  }

  return "Balanced";
}


// ===== Simple Plan Generation =====
function generateSimplePlan(strategy) {
  let sortedCourses;

  if (strategy === "Conservative") {
    // 优先低风险 + 高GPA
    sortedCourses = [...courses].sort(
      (a, b) => (a.risk - b.risk) || (b.gpa - a.gpa)
    );
  } else if (strategy === "Hedged") {
    // 接受风险 → 排序高风险
    sortedCourses = [...courses].sort((a, b) => b.risk - a.risk);
  } else {
    // Balanced → 按GPA
    sortedCourses = [...courses].sort((a, b) => b.gpa - a.gpa);
  }

  // 选前3门课
  return sortedCourses.slice(0, 3);
}


// ===== Evaluation (Scoring) =====
function evaluatePlan(courses) {
  let totalGPA = 0;
  let totalWorkload = 0;
  let totalRisk = 0;

  courses.forEach(c => {
    totalGPA += c.gpa;
    totalWorkload += c.workload;
    totalRisk += c.risk;
  });

  const avgGPA = totalGPA / courses.length;
  const avgWorkload = totalWorkload / courses.length;
  const avgRisk = totalRisk / courses.length;

  // 标准化（简化版）
  const gpaScore = avgGPA / 4;            // GPA越高越好
  const workloadScore = 1 - (avgWorkload / 30); // workload越低越好
  const riskScore = 1 - avgRisk;          // risk越低越好

  // 加权（固定权重）
  const totalScore =
    0.4 * gpaScore +
    0.3 * workloadScore +
    0.3 * riskScore;

  return {
    gpaScore,
    workloadScore,
    riskScore,
    totalScore
  };
}


// ===== Main Function =====
function submitPreferences() {
  const year = document.getElementById("year").value;
  const major = document.getElementById("major").value;
  const completed = document.getElementById("completed").value;
  const maxUnits = document.getElementById("max-units").value;
  const timeConflict = document.getElementById("time-conflict").value;
  const prereq = document.getElementById("prereq").value;
  const gpaPriority = document.getElementById("gpa-priority").value;
  const workload = document.getElementById("workload").value;
  const risk = document.getElementById("risk").value;
  const timePreference = document.getElementById("time-preference").value;

  const goals = Array.from(document.querySelectorAll('input[name="goal"]:checked'))
    .map(goal => goal.value);

  // 1️⃣ Strategy
  const strategy = inferStrategy(gpaPriority, workload, risk, goals);

  // 2️⃣ Generate Plan
  const selectedCourses = generateSimplePlan(strategy);

  // 3️⃣ Evaluate Plan
  const scores = evaluatePlan(selectedCourses);

  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = `
    <h3>Your Input Summary</h3>
    <p><strong>Year:</strong> ${year || "Not provided"}</p>
    <p><strong>Major:</strong> ${major || "Not provided"}</p>
    <p><strong>Goals:</strong> ${goals.length > 0 ? goals.join(", ") : "None"}</p>

    <hr>

    <h3>Strategy</h3>
    <p><strong>${strategy}</strong></p>

    <hr>

    <h3>Recommended Plan</h3>
    <p><strong>Courses:</strong> ${selectedCourses.map(c => c.name).join(", ")}</p>

    <p><strong>Total Score:</strong> ${scores.totalScore.toFixed(2)}</p>

    <ul>
      <li>GPA Score: ${scores.gpaScore.toFixed(2)}</li>
      <li>Workload Score: ${scores.workloadScore.toFixed(2)}</li>
      <li>Risk Score: ${scores.riskScore.toFixed(2)}</li>
    </ul>
  `;
}
