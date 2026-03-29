function inferStrategy(gpaPriority, workload, risk, goals) {
  if (gpaPriority === "High" && risk === "Low") {
    return "Conservative";
  }

  if (risk === "High" || goals.includes("Explore interests")) {
    return "Hedged";
  }

  return "Balanced";
}

function getMockPlans(strategy) {
  return [
    {
      name: "Conservative Plan",
      courses: ["UGBA 10", "STAT 20", "Breadth Course"],
      score: 86,
      risk: "Low enrollment risk, stable GPA-friendly schedule.",
      explanation: "This plan prioritizes predictability, lower risk, and manageable workload."
    },
    {
      name: "Balanced Plan",
      courses: ["ECON 100A", "STAT 20", "UGBA 10"],
      score: 82,
      risk: "Moderate workload and moderate enrollment uncertainty.",
      explanation: "This plan balances GPA, progress, and exploration across multiple goals."
    },
    {
      name: "Hedged Plan",
      courses: ["DATA C8", "ECON 100A", "Humanities Elective"],
      score: 80,
      risk: "Higher uncertainty, but more exploration and path flexibility.",
      explanation: "This plan keeps more future options open and includes exploratory choices."
    }
  ];
}

function highlightRecommendedPlan(plans, inferredStrategy) {
  return plans.map(plan => {
    if (
      (inferredStrategy === "Conservative" && plan.name === "Conservative Plan") ||
      (inferredStrategy === "Balanced" && plan.name === "Balanced Plan") ||
      (inferredStrategy === "Hedged" && plan.name === "Hedged Plan")
    ) {
      return { ...plan, recommended: true };
    }
    return { ...plan, recommended: false };
  });
}

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

  const strategy = inferStrategy(gpaPriority, workload, risk, goals);

  let plans = getMockPlans(strategy);
  plans = highlightRecommendedPlan(plans, strategy);

  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = `
    <h3>Your Input Summary</h3>
    <p><strong>Year:</strong> ${year || "Not provided"}</p>
    <p><strong>Intended Major:</strong> ${major || "Not provided"}</p>
    <p><strong>Completed Courses:</strong> ${completed || "Not provided"}</p>
    <p><strong>Semester Goals:</strong> ${goals.length > 0 ? goals.join(", ") : "None selected"}</p>
    <p><strong>Max Units:</strong> ${maxUnits || "Not provided"}</p>
    <p><strong>Time Conflict:</strong> ${timeConflict || "Not provided"}</p>
    <p><strong>Prerequisite Rule:</strong> ${prereq || "Not provided"}</p>
    <p><strong>GPA Priority Level:</strong> ${gpaPriority || "Not provided"}</p>
    <p><strong>Workload Tolerance:</strong> ${workload || "Not provided"}</p>
    <p><strong>Risk Acceptance:</strong> ${risk || "Not provided"}</p>
    <p><strong>Time Preference:</strong> ${timePreference || "Not provided"}</p>

    <hr>

    <h3>Inferred Strategy</h3>
    <p><strong>${strategy}</strong></p>

    <hr>

    <h3>Candidate Plans</h3>
    ${plans.map(plan => `
      <div style="border:1px solid #ccc; padding:12px; margin-bottom:12px; border-radius:8px;">
        <h4>${plan.name}${plan.recommended ? " ⭐ Recommended for you" : ""}</h4>
        <p><strong>Courses:</strong> ${plan.courses.join(", ")}</p>
        <p><strong>Total Score:</strong> ${plan.score}</p>
        <p><strong>Risk Note:</strong> ${plan.risk}</p>
        <p><strong>Strategy Explanation:</strong> ${plan.explanation}</p>
      </div>
    `).join("")}
  `;
}
