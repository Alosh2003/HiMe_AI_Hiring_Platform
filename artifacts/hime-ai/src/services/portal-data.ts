export const adminActivity = [
  { title: 'تم التحقق من شركة جديدة', detail: 'شركة التقنية المضافة', time: 'قبل ساعة', tone: 'primary' as const },
  { title: 'وظيفة تحتاج مراجعة', detail: 'وصف الوظيفة غير واضح', time: 'قبل 3 ساعات', tone: 'accent' as const },
  { title: 'بلاغ جديد', detail: 'بلاغ على محتوى وظيفة', time: 'قبل 5 ساعات', tone: 'neutral' as const },
  { title: 'اكتمل التحقق من شركة', detail: 'شركة البيانات المتقدمة', time: 'أمس', tone: 'primary' as const },
];

export const adminPermissions = [
  { label: 'إدارة المستخدمين', detail: 'إضافة أو تعليق حسابات', enabled: true },
  { label: 'التحقق من الشركات', detail: 'الموافقة على طلبات التحقق', enabled: true },
  { label: 'مراجعة المحتوى', detail: 'مراجعة الوظائف والتوصيات', enabled: true },
  { label: 'الوصول للبيانات', detail: 'تصدير التقارير والإحصاءات', enabled: false },
];

export const candidateActivity = [
  { title: 'تم تحليل سيرتك الذاتية', detail: 'استخرجنا 8 مهارات جديدة', time: 'قبل يوم', tone: 'primary' as const },
  { title: 'توصية جديدة', detail: 'مصمم تجربة مستخدم أول — 92%', time: 'قبل يومين', tone: 'accent' as const },
  { title: 'طلبك قيد المراجعة', detail: 'مدير منتج في شركة تقنية', time: 'قبل 3 أيام', tone: 'neutral' as const },
  { title: 'أكملت ملفك إلى 82%', detail: 'أضف مشروعاً لرفع النتيجة', time: 'قبل أسبوع', tone: 'accent' as const },
];

export const companyActivity = [
  { title: 'متقدم جديد بدرجة 94%', detail: 'سارة الحربي — مصمم منتجات', time: 'قبل ساعة', tone: 'primary' as const },
  { title: 'تم نشر وظيفتك', detail: 'مهندس واجهات أمامية', time: 'قبل يوم', tone: 'primary' as const },
  { title: '11 مرشح في القائمة المختصرة', detail: 'يحتاجون مراجعة', time: 'قبل يومين', tone: 'accent' as const },
  { title: 'اكتمل التحقق', detail: 'ملفك أصبح موثقاً', time: 'قبل أسبوع', tone: 'primary' as const },
];

export const companyBenefits = [
  'عمل مرن',
  'تأمين صحي',
  'إجازة 25 يوم',
  'ميزانية تعلم',
  'أسهم في الشركة',
  'فريق متعدد الثقافات',
];
