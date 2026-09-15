"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSession } from "@/lib/auth-api";

type GateState = "loading" | "authenticated" | "unauthenticated";

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    getSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          setState("authenticated");
          return;
        }
        setState("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => {
        if (!active) return;
        setState("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (state !== "authenticated") {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-slate-500" role="status" aria-live="polite">Verificando seu acesso…</div>;
  }
  return <>{children}</>;
}
