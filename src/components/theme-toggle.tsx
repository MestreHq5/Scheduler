"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("scheduler-theme", theme);
  } catch {
    // localStorage unavailable — theme just won't persist across reloads.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm w-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42M18.36 18.36l-1.42-1.42M7.06 7.06 5.64 5.64"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.5 14.5a8.5 8.5 0 1 1-9-11 6.8 6.8 0 0 0 9 11z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
