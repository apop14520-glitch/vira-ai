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

  it("disponibiliza o Wrangler na raiz para o deploy padrão dos Workers Builds", () => {
    const rootPackagePath = resolve(process.cwd(), "../../package.json");
    const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8")) as {
      devDependencies?: Record<string, string>;
    };

    expect(rootPackage.devDependencies?.wrangler).toBeTruthy();
  });

  it("disponibiliza a configuração-raiz para o comando padrão do Cloudflare", () => {
    const rootWranglerPath = resolve(process.cwd(), "../../wrangler.jsonc");
    const rootWrangler = JSON.parse(readFileSync(rootWranglerPath, "utf8")) as {
      main?: string;
      assets?: { directory?: string };
      vars?: Record<string, string>;
    };

    expect(rootWrangler.main).toBe("apps/web/.open-next/worker.js");
    expect(rootWrangler.assets?.directory).toBe("apps/web/.open-next/assets");
    expect(rootWrangler.vars?.API_INTERNAL_URL).toBe("https://137-131-255-128.nip.io");
  });

  it("verifica artefatos antes de publicar", () => {
    const packagePath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["check:cloudflare"]).toBe("node scripts/check-cloudflare-artifacts.mjs");
  });

  it("declara a origem pública da API para o Worker", () => {
    const wranglerPath = resolve(process.cwd(), "wrangler.jsonc");
    const wrangler = JSON.parse(readFileSync(wranglerPath, "utf8")) as {
      vars?: Record<string, string>;
    };

    expect(wrangler.vars?.API_INTERNAL_URL).toBe("https://137-131-255-128.nip.io");
  });

  it("documenta a topologia híbrida e o rollback", () => {
    const documentationPath = resolve(process.cwd(), "../../docs/deployment/CLOUDFLARE.md");
    const documentation = readFileSync(documentationPath, "utf8");

    for (const requiredText of [
      "vira-ai-web",
      "API_INTERNAL_URL",
      "137-131-255-128.nip.io",
      "feat/admin-ui-cloudflare",
      "pnpm --dir apps/web exec wrangler versions upload",
      "rollback",
    ]) {
      expect(documentation).toContain(requiredText);
    }
  });
});
