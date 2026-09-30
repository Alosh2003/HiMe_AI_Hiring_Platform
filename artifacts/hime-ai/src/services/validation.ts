export type LoginValues = {
  email: string;
  password: string;
};

export type RegistrationValues = LoginValues & {
  name: string;
  role: 'seeker' | 'company';
  termsAccepted: boolean;
};

export type CvFile = {
  name: string;
  size: number;
  type?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxCvSize = 10 * 1024 * 1024;
const supportedCvExtensions = ['.pdf', '.docx'];

export function validateLogin(values: LoginValues) {
  const errors: Partial<Record<keyof LoginValues, string>> = {};

  if (!values.email.trim()) errors.email = 'أدخل بريدك الإلكتروني.';
  else if (!emailPattern.test(values.email.trim())) errors.email = 'أدخل بريداً إلكترونياً صالحاً.';

  if (!values.password) errors.password = 'أدخل كلمة المرور.';
  else if (values.password.length < 8) errors.password = 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.';

  return errors;
}

export function validateRegistration(values: RegistrationValues) {
  const errors: Partial<Record<keyof RegistrationValues, string>> = validateLogin(values);

  if (!values.name.trim()) errors.name = 'أدخل الاسم الكامل.';
  if (!values.termsAccepted) errors.termsAccepted = 'وافق على الشروط للمتابعة.';

  return errors;
}

export function validateCvFile(file?: CvFile | null) {
  if (!file) return 'اختر ملفاً بصيغة PDF أو DOCX.';
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!supportedCvExtensions.includes(extension)) return 'صيغة الملف غير مدعومة. ارفع ملف PDF أو DOCX.';
  if (file.size > maxCvSize) return 'حجم الملف أكبر من 10MB.';
  return '';
}