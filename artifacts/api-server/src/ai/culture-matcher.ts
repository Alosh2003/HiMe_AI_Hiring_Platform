interface CultureMatchResult {
  score: number;
  notes: string;
}

const CULTURE_KEYWORDS: Record<string, string[]> = {
  "startup": ["سرعة", "مرونة", "مسؤولية", "نمو", "startup", "fast-paced", "growth"],
  "enterprise": ["استقرار", "هيكل", "عمليات", "enterprise", "structured", "processes"],
  "innovation": ["إبداع", "تجربة", "تعلم", "innovation", "experiment", "learning"],
  "collaboration": ["فريق", "تعاون", "شراكة", "collaboration", "teamwork", "partnership"],
  "impact": ["أثر", "هدف", "رسالة", "impact", "purpose", "mission"],
};

export function matchCulture(
  jobDescription: string,
  candidateSummary: string,
  candidateExperiences: { role: string; description: string; current: boolean }[],
): CultureMatchResult {
  const jobText = jobDescription.toLowerCase();
  const candText = `${candidateSummary} ${candidateExperiences.map((e) => `${e.role} ${e.description}`).join(" ")}`.toLowerCase();

  let totalSignals = 0;
  let matchedSignals = 0;
  const matchedTraits: string[] = [];

  for (const [trait, keywords] of Object.entries(CULTURE_KEYWORDS)) {
    const jobHasSignal = keywords.some((k) => jobText.includes(k));
    const candHasSignal = keywords.some((k) => candText.includes(k));

    if (jobHasSignal) {
      totalSignals++;
      if (candHasSignal) {
        matchedSignals++;
        matchedTraits.push(trait);
      }
    }
  }

  const score = totalSignals > 0 ? Math.round((matchedSignals / totalSignals) * 100) : 75;

  const notes = matchedTraits.length > 0
    ? `يتقاطع في: ${matchedTraits.join("، ")}`
    : "لا توجد إشرات ثقافية واضحة — محايد";

  return { score, notes };
}
