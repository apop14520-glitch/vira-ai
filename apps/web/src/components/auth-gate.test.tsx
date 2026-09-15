import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  replace: vi.fn(),
  pathname: "/business",
}));

vi.mock("@/lib/auth-api", () => ({ getSession: mocks.getSession }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

import { AuthGate } from "@/components/auth-gate";

describe("AuthGate", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.replace.mockReset();
  });

  it("mostra o conteúdo quando a sessão é válida", async () => {
    mocks.getSession.mockResolvedValue({ authenticated: true, username: "admin", organization_id: "org-local" });

    render(<AuthGate><span>conteúdo protegido</span></AuthGate>);

    await waitFor(() => expect(screen.getByText("conteúdo protegido")).toBeInTheDocument());
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redireciona para o login quando a sessão não existe", async () => {
    mocks.getSession.mockResolvedValue(null);

    render(<AuthGate><span>conteúdo protegido</span></AuthGate>);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Fbusiness"));
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });
});
