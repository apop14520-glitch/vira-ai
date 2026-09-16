"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { getSession } from "@/lib/auth-api";
import type { AdminSession } from "@/lib/auth-api";

type GateState = "loading" | "authenticated" | "unauthenticated";
const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession | null {
  return useContext(AdminSessionContext);
}

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let active = true;
    setState("loading");
    setSession(null);
    getSession()
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession) {
          setState("authenticated");
          return;
        }
        setState("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
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
  return <AdminSessionContext.Provider value={session}>{children}</AdminSessionContext.Provider>;
}
