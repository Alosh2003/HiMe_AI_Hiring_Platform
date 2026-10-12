import { db } from "@workspace/db";
import {
  usersTable,
  companiesTable,
  jobsTable,
  skillsTable,
  jobSkillsTable,
  candidatesTable,
  candidateSkillsTable,
  experiencesTable,
  educationTable,
  projectsTable,
  certificationsTable,
  applicationsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // ─── Skills ──────────────────────────────────────────────────────────────
  const skillNames = [
    "React", "TypeScript", "JavaScript", "Node.js", "Python", "Product Management",
    "User Research", "Figma", "Design Systems", "Prototyping", "Arabic UX",
    "Product Strategy", "AI Products", "Roadmapping", "B2B SaaS", "Analytics",
    "Arabic Writing", "Content Strategy", "SEO", "English", "Communication",
    "Leadership", "Agile", "Machine Learning", "Data Science", "Cloud Computing",
  ];

  const skillIds: Record<string, number> = {};
  for (const name of skillNames) {
    const existing = await db.query.skillsTable.findFirst({
      where: eq(skillsTable.name, name),
    });
    if (existing) {
      skillIds[name] = existing.id;
    } else {
      const inserted = await db.insert(skillsTable).values({
        name,
        category: name === "Communication" || name === "Leadership" ? "soft" :
          name === "Arabic Writing" || name === "English" ? "language" :
          name === "React" || name === "TypeScript" || name === "Machine Learning" ? "technical" : "professional",
      }).returning();
      skillIds[name] = inserted[0].id;
    }
  }
  console.log(`Skills: ${Object.keys(skillIds).length}`);

  // ─── Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);

  // Admin user
  const adminUser = await db.insert(usersTable).values({
    email: "admin@hime.ai",
    passwordHash,
    name: "سلمان القحطاني",
    role: "admin",
  }).onConflictDoNothing().returning();

  // Company user
  const companyUser = await db.insert(usersTable).values({
    email: "company@hime.ai",
    passwordHash,
    name: "مِداد للتقنية",
    role: "company",
  }).onConflictDoNothing().returning();

  // Seeker user
  const seekerUser = await db.insert(usersTable).values({
    email: "seeker@hime.ai",
    passwordHash,
    name: "ليان العتيبي",
    role: "seeker",
  }).onConflictDoNothing().returning();

  console.log("Users created");

  // ─── Company ─────────────────────────────────────────────────────────────
  const company = await db.insert(companiesTable).values({
    userId: companyUser[0]?.id || adminUser[0]!.id,
    name: "مِداد للتقنية",
    industry: "تقنية المعلومات",
    location: "الرياض، السعودية",
    website: "https://medad.example",
    description: "نبني أدوات تجعل العمل العربي أكثر وضوحاً وإنسانية.",
    employeeCount: 150,
    foundedYear: 2022,
    verified: true,
    verificationStatus: "verified",
    verifiedAt: new Date(),
  }).returning();

  const companyId = company[0].id;
  console.log("Company created");

  // ─── Jobs ────────────────────────────────────────────────────────────────
  const jobs = [
    {
      title: "مصمم تجربة مستخدم أول",
      description: "نبحث عن مصمم تجربة مستخدم أول شغوف ببناء منتجات رقمية عربية واضحة. ستعمل مع فريق متعدد التخصصات في بيئة تتعلم فيها كل يوم. المسؤوليات: تصميم تجارب المستخدم، إجراء أبحاث المستخدمين، وبناء أنظمة التصميم.",
      industry: "تقنية المعلومات",
      location: "الرياض، السعودية",
      contractType: "full-time" as const,
      experienceLevel: "senior" as const,
      salaryMin: 18000,
      salaryMax: 24000,
      requiredSkills: ["Figma", "User Research", "Arabic UX"],
      preferredSkills: ["Design Systems", "Prototyping"],
    },
    {
      title: "مدير منتج — منصات الذكاء الاصطناعي",
      description: "نبحث عن مدير منتج لقيادة منصات الذكاء الاصطناعي. المسؤوليات: تحديد رؤية المنتج، العمل مع فرق الهندسة والتصميم، وتحليل بيانات المستخدمين.",
      industry: "تقنية المعلومات",
      location: "الرياض أو عن بعد",
      contractType: "full-time" as const,
      experienceLevel: "lead" as const,
      salaryMin: 22000,
      salaryMax: 30000,
      requiredSkills: ["Product Strategy", "AI Products", "Roadmapping"],
      preferredSkills: ["B2B SaaS", "Analytics"],
    },
    {
      title: "مهندس واجهات أمامية",
      description: "نبحث عن مهندس واجهات أمامية لبناء تطبيقات ويب حديثة. المسؤوليات: تطوير مكونات React، تحسين الأداء، والعمل مع فرق التصميم.",
      industry: "تقنية المعلومات",
      location: "الرياض أو عن بعد",
      contractType: "full-time" as const,
      experienceLevel: "mid" as const,
      salaryMin: 15000,
      salaryMax: 20000,
      requiredSkills: ["React", "TypeScript", "JavaScript"],
      preferredSkills: ["Node.js", "Cloud Computing"],
    },
    {
      title: "كاتب محتوى تقني",
      description: "نبحث عن كاتب محتوى تقني لإنشاء محتوى عربي عالي الجودة. المسؤوليات: كتابة المقالات التقنية، تطوير استراتيجية المحتوى، وتحسين SEO.",
      industry: "التسويق",
      location: "عن بعد",
      contractType: "contract" as const,
      experienceLevel: "entry" as const,
      salaryMin: 9000,
      salaryMax: 13000,
      requiredSkills: ["Arabic Writing", "Content Strategy", "SEO"],
      preferredSkills: ["English", "Communication"],
    },
  ];

  for (const job of jobs) {
    const inserted = await db.insert(jobsTable).values({
      companyId,
      title: job.title,
      description: job.description,
      industry: job.industry,
      location: job.location,
      contractType: job.contractType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    }).returning();

    const jobId = inserted[0].id;

    for (const skillName of job.requiredSkills) {
      await db.insert(jobSkillsTable).values({
        jobId,
        skillId: skillIds[skillName]!,
        isRequired: true,
      });
    }
    for (const skillName of job.preferredSkills) {
      await db.insert(jobSkillsTable).values({
        jobId,
        skillId: skillIds[skillName]!,
        isRequired: false,
      });
    }
  }
  console.log("Jobs created");

  // ─── Candidate ───────────────────────────────────────────────────────────
  const candidate = await db.insert(candidatesTable).values({
    userId: seekerUser[0]?.id || adminUser[0]!.id,
    headline: "مصمم منتجات يهتم بما يشعر به الناس",
    summary: "أصمم منتجات رقمية عربية واضحة، من البحث إلى الإطلاق، مع اهتمام خاص بإمكانية الوصول واللغة.",
    location: "الرياض، السعودية",
    yearsExperience: 4,
    preferences: {
      industries: ["تقنية المعلومات"],
      contractTypes: ["full-time"],
      remote: true,
      salaryMin: 18000,
    },
    completion: 82,
  }).returning();

  const candidateId = candidate[0].id;

  // Candidate skills
  const candidateSkillNames = ["Figma", "User Research", "Arabic UX", "Design Systems", "Prototyping"];
  for (const name of candidateSkillNames) {
    await db.insert(candidateSkillsTable).values({
      candidateId,
      skillId: skillIds[name]!,
      proficiency: 4,
      yearsExperience: 3,
    });
  }

  // Experiences
  await db.insert(experiencesTable).values({
    candidateId,
    role: "مصمم منتجات",
    company: "ستوديو رِواق",
    location: "الرياض",
    description: "تصميم تجارب رقمية لمنتجات مالية وتعليمية.",
    startDate: "2021-01",
    endDate: null,
    current: true,
  });

  // Education
  await db.insert(educationTable).values({
    candidateId,
    degree: "بكالوريوس",
    field: "تصميم الوسائط الرقمية",
    institution: "جامعة الملك سعود",
    year: 2020,
  });

  // Projects
  await db.insert(projectsTable).values({
    candidateId,
    name: "مَسار",
    description: "تجربة تخطيط مالي للشباب.",
    url: "https://masar.example",
  });

  // Certifications
  await db.insert(certificationsTable).values({
    candidateId,
    name: "Google UX Design",
    issuer: "Google",
    year: 2022,
  });

  console.log("Candidate created");

  // ─── Applications ────────────────────────────────────────────────────────
  const allJobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.companyId, companyId),
  });

  if (allJobs[0]) {
    await db.insert(applicationsTable).values({
      jobId: allJobs[0].id,
      candidateId,
      status: "reviewing",
      matchScore: 92,
    });
  }
  if (allJobs[2]) {
    await db.insert(applicationsTable).values({
      jobId: allJobs[2].id,
      candidateId,
      status: "shortlisted",
      matchScore: 76,
    });
  }

  console.log("Applications created");
  console.log("Seeding complete!");
  console.log("");
  console.log("Test accounts:");
  console.log("  Admin:    admin@hime.ai / password123");
  console.log("  Company:  company@hime.ai / password123");
  console.log("  Seeker:   seeker@hime.ai / password123");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
