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
});
