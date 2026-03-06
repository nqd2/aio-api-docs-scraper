"use client";

import { useMemo } from "react";
import { ThemePreference, useTheme } from "./theme";

function nextTheme(theme: ThemePreference): ThemePreference {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const label = useMemo(() => {
    if (theme === "system") return `Theme: System (${resolvedTheme})`;
    return `Theme: ${theme}`;
  }, [theme, resolvedTheme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(theme))}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-card"
      aria-label={label}
      title={label}
    >
      <span className="text-xs font-semibold text-muted-foreground">Theme</span>
      <span className="rounded-lg border border-border bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
        {theme === "system" ? resolvedTheme : theme}
      </span>
    </button>
  );
}

