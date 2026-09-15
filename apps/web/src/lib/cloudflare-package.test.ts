import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato de build Cloudflare", () => {
  it("declara scripts e dependências do Workers", () => {
    const packagePath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.preview).toContain("opennextjs-cloudflare preview");
    expect(packageJson.scripts?.deploy).toContain("opennextjs-cloudflare deploy");
    expect(packageJson.scripts?.["cf-typegen"]).toContain("wrangler types");
    expect(packageJson.dependencies?.["@opennextjs/cloudflare"]).toBeTruthy();
    expect(packageJson.devDependencies?.wrangler).toBeTruthy();
  });

  it("verifica artefatos antes de publicar", () => {
    const packagePath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["check:cloudflare"]).toBe("node scripts/check-cloudflare-artifacts.mjs");
  });
});
