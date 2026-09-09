"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const themeLabel: Record<Theme, string> = {
  dark: "Ativar modo claro",
  light: "Ativar modo escuro",
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(currentTheme);
    setReady(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("vira-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={themeLabel[theme]}
      title={themeLabel[theme]}
      className="group flex h-9 items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-2.5 text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
    >
      <span className="relative flex h-5 w-9 items-center rounded-full bg-slate-800 p-0.5 transition group-hover:bg-slate-700">
        <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-cyan-300 text-[10px] text-slate-950 shadow-sm transition-transform ${ready && theme === "light" ? "translate-x-4" : "translate-x-0"}`}>
          {theme === "light" ? "☀" : "☾"}
        </span>
      </span>
      <span className="hidden text-xs font-medium sm:inline">{theme === "light" ? "Claro" : "Escuro"}</span>
    </button>
  );
}

