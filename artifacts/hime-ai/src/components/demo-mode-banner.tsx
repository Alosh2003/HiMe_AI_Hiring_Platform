import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { isDemoModeActive } from '@/services/api/demo-api';

/**
 * Shown the moment the app falls back to demo data. The old behaviour was
 * to render invented jobs and candidates with no visible indication — in a
 * hiring context that is a lie the user cannot detect.
 */
export function DemoModeBanner() {
  const [active, setActive] = useState(isDemoModeActive());

  useEffect(() => {
    const onDemoMode = () => setActive(true);
    window.addEventListener('hime-demo-mode', onDemoMode);
    return () => window.removeEventListener('hime-demo-mode', onDemoMode);
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      data-testid="banner-demo-mode"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-xs font-bold text-destructive-foreground"
    >
      <TriangleAlert className="h-4 w-4 shrink-0" />
      تعذر الوصول إلى الخادم — البيانات المعروضة الآن تجريبية وليست حقيقية.
    </div>
  );
}
