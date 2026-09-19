import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("layout responsivo do painel de configurações", () => {
  it("mantém o painel de configurações compacto e rolável, sem altura fixa, no celular e no computador", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(css).toContain(".settings-nav {");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".settings-scroll");
    expect(css).not.toContain("  height: min(760px");
    expect(css).toMatch(/\.settings-panel--bounded \{[^}]*height: auto;/);
  });

  it("mantém o fundo azul contínuo sem uma moldura preta no login", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const darkLogin = css.match(/(?:^|\n)\.login-page--dark \{[\s\S]*?\n\}/)?.[0];
    const darkLoginOverlay = css.match(/(?:^|\n)\.login-page--dark::after \{[\s\S]*?\n\}/)?.[0];
    const darkLoginStage = css.match(/(?:^|\n)\.login-page--dark \.login-stage \{[\s\S]*?\n\}/)?.[0];

    expect(darkLogin).toContain("linear-gradient(135deg, #061a36 0%, #0b2a4b 52%, #062b3f 100%)");
    expect(darkLoginOverlay).toContain("background: transparent;");
    expect(darkLoginStage).toContain("background: transparent;");
  });

  it("usa a logo transparente fornecida como fundo do efeito líquido", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(existsSync(resolve(process.cwd(), "public/brand/vira.png"))).toBe(true);
    expect(css).toContain('background: url("/brand/vira.png") center / contain no-repeat;');
  });

  it("faz o login ocupar a viewport sem bordas herdadas do body", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const darkLogin = css.match(/(?:^|\n)\.login-page--dark \{[\s\S]*?\n\}/)?.[0];
    const darkLoginStage = css.match(/(?:^|\n)\.login-page--dark \.login-stage \{[\s\S]*?\n\}/)?.[0];

    expect(darkLogin).toContain("min-height: 100dvh;");
    expect(darkLogin).toContain("padding: 0;");
    expect(darkLoginStage).toContain("min-height: 100%;");
    expect(darkLoginStage).toContain("width: 100%;");
  });

  it("mantém os marcadores da senha visíveis no tema claro", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const lightLoginInput = css.match(/html\[data-theme="light"\] \.login-page--dark \.login-input \{[\s\S]*?\n\}/)?.[0];

    expect(lightLoginInput).toBeDefined();
    expect(lightLoginInput).toContain("color: #0f172a !important;");
    expect(lightLoginInput).toContain("-webkit-text-fill-color: #0f172a;");
    expect(lightLoginInput).toContain("caret-color: #0f172a;");
  });
});
