import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const artifactRoot = resolve(process.cwd(), ".open-next");
const workerPath = join(artifactRoot, "worker.js");
const assetsPath = join(artifactRoot, "assets");
const forbiddenNames = [
  "API_ACCESS_TOKEN",
  "ADMIN_ACCESS_TOKEN",
  "ADMIN_INITIAL_PASSWORD",
  "FOURSQUARE_API_KEY",
  "NEXT_PUBLIC_API_INTERNAL_URL",
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".webmanifest"]);
const secretValuePatterns = [
  /\bfsq[0-9A-Za-z_-]{16,}\b/,
  /\bsk-[0-9A-Za-z_-]{16,}\b/,
  /\b(?:eyJ|gh[pousr]_[0-9A-Za-z_\-]{16,})\b/,
];

function fail(message) {
  console.error(`Cloudflare: ${message}`);
  process.exitCode = 1;
}

function collectTextFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(entryPath));
    } else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

if (!existsSync(workerPath) || !lstatSync(workerPath).isFile()) {
  fail("o artefato .open-next/worker.js não foi encontrado; execute o build antes da publicação.");
} else if (!existsSync(assetsPath) || !lstatSync(assetsPath).isDirectory()) {
  fail("o diretório .open-next/assets não foi encontrado; execute o build antes da publicação.");
} else {
  const files = [workerPath, ...collectTextFiles(assetsPath)];
  const forbiddenNamePattern = new RegExp(forbiddenNames.join("|"));
  const emittedFiles = files.map((filePath) => ({
    filePath,
    content: readFileSync(filePath, "utf8"),
  }));
  const forbiddenFile = emittedFiles.find(({ content }) => forbiddenNamePattern.test(content));
  const secretValueFile = emittedFiles.find(({ content }) => secretValuePatterns.some((pattern) => pattern.test(content)));

  if (forbiddenFile) {
    fail(`referência a credencial proibida encontrada em ${relative(process.cwd(), forbiddenFile.filePath)}.`);
  } else if (secretValueFile) {
    fail(`valor com formato de credencial encontrado em ${relative(process.cwd(), secretValueFile.filePath)}.`);
  } else {
    console.log(`Cloudflare: artefatos verificados (${files.length} arquivos textuais); nenhum segredo detectado.`);
  }
}
