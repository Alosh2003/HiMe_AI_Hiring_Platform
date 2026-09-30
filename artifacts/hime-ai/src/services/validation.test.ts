import { describe, expect, it } from 'vitest';
import { validateCvFile, validateLogin, validateRegistration } from './validation';

describe('trust-critical validation', () => {
  it('rejects incomplete or malformed sign-in values', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'أدخل بريدك الإلكتروني.',
      password: 'أدخل كلمة المرور.',
    });
    expect(validateLogin({ email: 'not-an-email', password: 'short' })).toEqual({
      email: 'أدخل بريداً إلكترونياً صالحاً.',
      password: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    });
  });

  it('requires account details, role terms, and a valid password on registration', () => {
    const errors = validateRegistration({
      name: '',
      email: 'person@example.com',
      password: 'password',
      role: 'seeker',
      termsAccepted: false,
    });

    expect(errors.name).toBe('أدخل الاسم الكامل.');
    expect(errors.password).toBeUndefined();
    expect(errors.termsAccepted).toBe('وافق على الشروط للمتابعة.');
  });

  it('rejects missing, unsupported, and oversized CV files', () => {
    expect(validateCvFile()).toContain('اختر ملفاً');
    expect(validateCvFile({ name: 'resume.txt', size: 1 })).toContain('غير مدعومة');
    expect(validateCvFile({ name: 'resume.pdf', size: 10 * 1024 * 1024 + 1 })).toContain('أكبر من 10MB');
    expect(validateCvFile({ name: 'resume.PDF', size: 1024 })).toBe('');
    expect(validateCvFile({ name: 'resume.docx', size: 1024 })).toBe('');
  });
});