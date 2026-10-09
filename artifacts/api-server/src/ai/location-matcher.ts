interface LocationMatchResult {
  score: number;
  notes: string;
}

export function matchLocation(
  jobLocation: string,
  candidateLocation: string,
  candidateRemote: boolean,
): LocationMatchResult {
  const jobLoc = jobLocation.toLowerCase().trim();
  const candLoc = candidateLocation.toLowerCase().trim();

  // Exact match
  if (jobLoc === candLoc) {
    return { score: 100, notes: "نفس الموقع" };
  }

  // Remote job or candidate prefers remote
  if (jobLoc.includes("remote") || jobLoc.includes("عن بعد")) {
    return { score: 95, notes: "عمل عن بعد — متاح للجميع" };
  }
  if (candLoc.includes("remote") || candLoc.includes("عن بعد")) {
    return { score: 80, notes: "يفضل العمل عن بعد" };
  }

  // Same country (Saudi Arabia cities)
  const saudiCities = ["الرياض", "جدة", "الدمام", "مكة", "المدينة", "الخبر", "الطائف", "تبوك", "بريدة", "خميس مشيط", "riyadh", "jeddah", "dammam", "mecca", "medina", "khobar"];
  const jobIsSaudi = saudiCities.some((c) => jobLoc.includes(c));
  const candIsSaudi = saudiCities.some((c) => candLoc.includes(c));

  if (jobIsSaudi && candIsSaudi) {
    // Same country, different city
    if (candidateRemote) {
      return { score: 75, notes: "نفس المدينة مع خيار العمل عن بعد" };
    }
    return { score: 60, notes: "نفس البلد — مدينة مختلفة" };
  }

  if (candidateRemote) {
    return { score: 65, notes: "مرونة العمل عن بعد تساعد" };
  }

  return { score: 30, notes: "موقع مختلف — قد يحتاج ترتيب" };
}
