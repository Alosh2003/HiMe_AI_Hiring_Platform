import { ArrowUpLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';
import { PublicNav } from '@/components/app-kit';

export default function NotFound() {
  return <><PublicNav /><main className="surface-grid flex min-h-[70dvh] items-center justify-center px-4"><div className="max-w-md text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Compass className="h-8 w-8" /></div><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-primary">404</p><h1 className="mt-3 text-3xl font-bold">هذه الصفحة أخذت منعطفاً آخر.</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">ارجع إلى المساحة الرئيسية أو استكشف الفرص المتاحة.</p><Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-not-found-home">العودة للرئيسية <ArrowUpLeft className="h-4 w-4" /></Link></div></main></>;
}