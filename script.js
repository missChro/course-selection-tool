// ===== Mock Course Data =====
const courses = [
  { name: "UGBA 10", units: 4, workload: 18, gpa: 3.6, risk: 0.2 },
  { name: "STAT 20", units: 4, workload: 20, gpa: 3.4, risk: 0.3 },
  { name: "ECON 100A", units: 4, workload: 25, gpa: 3.3, risk: 0.5 },
  { name: "DATA 8", units: 4, workload: 22, gpa: 3.5, risk: 0.4 },
  { name: "HISTORY 7A", units: 4, workload: 15, gpa: 3.7, risk: 0.2 },
  { name: "PHILOS 3", units: 4, workload: 12, gpa: 3.8, risk: 0.1 }
];


// ===== Strategy =====
function inferStrategy(gpaPriority, workload, risk, goals) {
  if (gpaPriority === "High" && risk === "Low") return "Conservative";
  if (risk === "High" || goals.includes("Explore interests")) return "Hedged";
  return "Balanced";
}


// ===== Weights =====
function getWeights(gpaPriority, workload, risk) {
  let wGPA = 0.33;
  let wWorkload = 0.33;
  let wRisk = 0.34;

  if (gpaPriority === "High") wGPA += 0.2;
  if (workload === "Low") wWorkload += 0.2;
  if (risk === "Low") wRisk += 0.2;

  const total = wGPA + wWorkload + wRisk;

  return {
    wGPA: wGPA / total,
    wWorkload: wWorkload / total,
    wRisk: wRisk / total
  };
}


// ===== Plan Generation =====
function generatePlan(strategy) {
  let sorted;

  if (strategy === "Conservative") {
    sorted = [...courses].sort((a, b) => (a.risk - b.risk) || (b.gpa - a.gpa));
  } else if (strategy === "Hedged") {
    sorted = [...courses].sort((a, b) => b.risk - a.risk);
  } else {
    sorted = [...courses].sort((a, b) => b.gpa - a.gpa);
  }

  return sorted.slice(0, 3);
}


// ===== Evaluation =====
function evaluatePlan(courses, weights) {
  let g = 0, w = 0, r = 0;

  courses.forEach(c => {
    g += c.gpa;
    w += c.workload;
    r += c.risk;
  });

  const avgGPA = g / courses.length;
  const avgWorkload = w / courses.length;
  const avgRisk = r / courses.length;

  const gpaScore = avgGPA / 4;
  const workloadScore = 1 - (avgWorkload / 30);
  const riskScore = 1 - avgRisk;

  const total =
    weights.wGPA * gpaScore +
    weights.wWorkload * workloadScore +
    weights.wRisk * riskScore;

  return { gpaScore, workloadScore, riskScore, total };
}


// ===== Main =====
function submitPreferences() {
  const gpaPriority = document.getElementById("gpa-priority").value;
  const workload = document.getElementById("workload").value;
  const risk = document.getElementById("risk").value;

  const goals = Array.from(document.querySelectorAll('input[name="goal"]:checked'))
    .map(g => g.value);

  const inferred = inferStrategy(gpaPriority, workload, risk, goals);
  const weights = getWeights(gpaPriority, workload, risk);

  const strategies = ["Conservative", "Balanced", "Hedged"];

  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = `
    <h3>Inferred Strategy: ${inferred}</h3>
    <hr>
    <h3>All Plans</h3>
  `;

  strategies.forEach(s => {
    const plan = generatePlan(s);
    const score = evaluatePlan(plan, weights);

    resultDiv.innerHTML += `
      <div style="border:1px solid #ccc; padding:12px; margin-bottom:12px; border-radius:8px;">
        <h4>${s} ${s === inferred ? "⭐ Recommended" : ""}</h4>
        <p><strong>Courses:</strong> ${plan.map(c => c.name).join(", ")}</p>
        <p><strong>Total Score:</strong> ${score.total.toFixed(2)}</p>

        <ul>
          <li>GPA: ${score.gpaScore.toFixed(2)}</li>
          <li>Workload: ${score.workloadScore.toFixed(2)}</li>
          <li>Risk: ${score.riskScore.toFixed(2)}</li>
        </ul>
      </div>
    `;
  });
}
