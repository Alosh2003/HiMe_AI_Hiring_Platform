interface EducationMatchResult {
  score: number;
  notes: string;
}

const DEGREE_LEVELS: Record<string, number> = {
  "دبلوم": 1,
  "بكالوريوس": 2,
  "bachelor": 2,
  "ماجستير": 3,
  "master": 3,
  "دكتوراه": 4,
  "phd": 4,
  "doctorate": 4,
};

export function matchEducation(
  jobDescription: string,
  candidateEducation: { degree: string; field: string; year: number }[],
): EducationMatchResult {
  if (candidateEducation.length === 0) {
    return { score: 50, notes: "لا توجد معلومات تعليمية" };
  }

  const jobText = jobDescription.toLowerCase();
  let score = 70; // Base score for having education
  const notes: string[] = [];

  // Check degree level requirement
  const requiresBachelor = /بكالوريوس|bachelor|درجة جامعية/.test(jobText);
  const requiresMaster = /ماجستير|master|درجة عليا/.test(jobText);

  const highestDegree = candidateEducation.reduce((best, edu) => {
    const level = DEGREE_LEVELS[edu.degree.toLowerCase()] || 1;
    return level > best ? level : best;
  }, 0);

  if (requiresMaster) {
    if (highestDegree >= 3) {
      score += 20;
      notes.push("درجة عليا مطلوبة ومتوفرة");
    } else {
      score -= 15;
      notes.push("درجة عليا مطلوبة");
    }
  } else if (requiresBachelor) {
    if (highestDegree >= 2) {
      score += 15;
      notes.push("درجة جامعية متوفرة");
    } else {
      score -= 10;
      notes.push("درجة جامعية مفضلة");
    }
  }

  // Field relevance
  const jobKeywords = extractFieldKeywords(jobText);
  const candidateFields = candidateEducation.map((e) => e.field.toLowerCase());
  const fieldMatch = candidateFields.some((field) =>
    jobKeywords.some((kw) => field.includes(kw) || kw.includes(field)),
  );

  if (fieldMatch) {
    score += 10;
    notes.push("تخصص ذو صلة");
  }

  return {
    score: Math.min(Math.max(score, 0), 100),
    notes: notes.length > 0 ? notes.join("، ") : "تعليم مناسب",
  };
}

function extractFieldKeywords(text: string): string[] {
  const FIELDS = [
    "computer science", "software engineering", "information technology",
    "business administration", "engineering", "mathematics", "physics",
    "economics", "finance", "marketing", "design", "psychology",
    "علوم الحاسب", "هندسة البرمجيات", "تقنية المعلومات", "إدارة الأعمال",
    "الهندسة", "الرياضيات", "الفيزياء", "الاقتصاد", "المالية", "التسويق",
    "التصميم", "علم النفس",
  ];
  return FIELDS.filter((f) => text.includes(f.toLowerCase()));
}
