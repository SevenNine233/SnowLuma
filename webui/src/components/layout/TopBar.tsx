import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { resolved, mode, setMode } = useTheme();
  const cycleTheme = () => setMode(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system');

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-zinc-200/60 dark:border-white/6 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={cycleTheme}
        className="size-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/8 transition-all duration-150 cursor-pointer"
      >
        {resolved === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </header>
  );
}
