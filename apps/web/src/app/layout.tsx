import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  title: "VIRA.AI",
  description: "Fundação do ecossistema SaaS brasileiro VIRA.AI",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-preference" strategy="beforeInteractive">
          {`(() => {
            try {
              const savedTheme = localStorage.getItem("vira-theme");
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              document.documentElement.dataset.theme = savedTheme ?? (prefersDark ? "dark" : "light");
            } catch {
              document.documentElement.dataset.theme = "dark";
            }
          })();`}
        </Script>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
