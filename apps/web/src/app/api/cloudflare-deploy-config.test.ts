import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("publicação Cloudflare", () => {
  it("preserva as variáveis de runtime configuradas no painel", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts.deploy).toContain("opennextjs-cloudflare deploy -- --keep-vars");
  });
});
