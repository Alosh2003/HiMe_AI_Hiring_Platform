interface SalaryMatchResult {
  score: number;
  notes: string;
}

export function matchSalary(
  jobSalaryMin?: number,
  jobSalaryMax?: number,
  candidateSalaryMin?: number,
): SalaryMatchResult {
  if (!jobSalaryMin && !jobSalaryMax) {
    return { score: 80, notes: "الراتب يحدد عند المقابلة" };
  }

  if (!candidateSalaryMin) {
    return { score: 70, notes: "لا يوجد توقع راتب واضح" };
  }

  const jobMid = jobSalaryMin && jobSalaryMax
    ? (jobSalaryMin + jobSalaryMax) / 2
    : (jobSalaryMin || jobSalaryMax || 0);

  const ratio = candidateSalaryMin / jobMid;

  if (ratio <= 0.8) return { score: 100, notes: "التوقع ضمن النطاق المتوقع" };
  if (ratio <= 1.0) return { score: 90, notes: "التوقع مناسب للنطاق" };
  if (ratio <= 1.2) return { score: 70, notes: "التوقع أعلى قليلاً من النطاق" };
  if (ratio <= 1.5) return { score: 50, notes: "الفرق في التوقع يحتاج حوار" };
  return { score: 30, notes: "فرق كبير في التوقع" };
}
