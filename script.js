function inferStrategy(gpaPriority, workload, risk, goals) {
  // Conservative:
  // GPA high + low risk + control workload
  if (
    gpaPriority === "High" &&
    risk === "Low"
  ) {
    return "Conservative";
  }

  // Hedged:
  // high risk acceptance OR exploration goal
  if (
    risk === "High" ||
    goals.includes("Explore interests")
  ) {
    return "Hedged";
  }

  // Otherwise:
  return "Balanced";
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
  `;
}
