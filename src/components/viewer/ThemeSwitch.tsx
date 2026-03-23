import { Moon, Sun } from 'lucide-react';
import { useViewerStore } from '@/stores';

const iconBtnClass =
  'inline-flex items-center justify-center w-10 h-10 p-0 border border-border-subtle rounded-[10px] bg-white/94 text-slate-700 relative cursor-pointer overflow-hidden [&>svg]:shrink-0 [&>span]:sr-only disabled:opacity-45 disabled:cursor-default hover:not-disabled:border-primary/28 hover:not-disabled:bg-blue-100/58 hover:not-disabled:text-primary-text dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:not-disabled:bg-slate-700';

export function ThemeSwitch() {
  const theme = useViewerStore((state) => state.theme);
  const toggleTheme = useViewerStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      className={iconBtnClass}
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
