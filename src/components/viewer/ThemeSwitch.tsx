import { Moon, Sun } from 'lucide-react';
import { useViewerStore } from '@/stores';

export function ThemeSwitch() {
  const theme = useViewerStore((state) => state.theme);
  const toggleTheme = useViewerStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      className="viewer-toolbar__icon-button"
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      data-tooltip={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
