import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

/** localStorage key shared with the no-flash script in index.html. */
export const THEME_KEY = 'hime_theme';

/** Apply the theme class to <html> and persist it. */
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    /* storage unavailable (private mode) — the class toggle still works */
  }
}

function themeIsDark(): boolean {
  return document.documentElement.classList.contains('dark') || localStorage.getItem(THEME_KEY) === 'dark';
}

/**
 * Light/dark switch wired to the `.dark` variant on <html>: all surfaces use
 * semantic tokens (background, card, sidebar…), so one class flips the whole
 * site. Toggle appears in the public header and the portal topbar.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => themeIsDark());
  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      data-testid="button-theme-toggle"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
