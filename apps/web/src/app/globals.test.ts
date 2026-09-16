import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("layout responsivo do painel de configurações", () => {
  it("transforma o menu suspenso em um painel rolável de tela cheia no celular", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(css).toContain(".settings-nav {");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".settings-scroll");
  });

  it("mantém o fundo azul contínuo sem uma moldura preta no login", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const darkLogin = css.match(/html\[data-theme\] \.login-page--dark \{[\s\S]*?\n\}/)?.[0];
    const darkLoginOverlay = css.match(/html\[data-theme\] \.login-page--dark::after \{[\s\S]*?\n\}/)?.[0];
    const darkLoginStage = css.match(/html\[data-theme\] \.login-page--dark \.login-stage \{[\s\S]*?\n\}/)?.[0];

    expect(darkLogin).toContain("linear-gradient(135deg, #061a36 0%, #0b2a4b 52%, #062b3f 100%)");
    expect(darkLoginOverlay).toContain("background: transparent;");
    expect(darkLoginStage).toContain("background: transparent;");
  });
});
