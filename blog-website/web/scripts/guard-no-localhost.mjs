import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const CHECK_DIRS = ["src", "e2e"];
const CHECK_FILES = ["next.config.ts", "playwright.config.ts", "vitest.config.ts"];

const EXT_ALLOWLIST = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const loopbackHosts = [
  "local" + "host",
  ["127", "0", "0", "1"].join("."),
  ["0", "0", "0", "0"].join("."),
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RE = new RegExp(
  `(https?:\\/\\/)?(${loopbackHosts.map(escapeRegExp).join("|")})(:\\d+)?`,
);

async function collectFiles(absPath) {
  const st = await fs.stat(absPath);
  if (st.isFile()) return [absPath];
  if (!st.isDirectory()) return [];

  const entries = await fs.readdir(absPath, { withFileTypes: true });
  const out = [];

  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.name === "node_modules" || e.name === ".next" || e.name === "playwright-report" || e.name === "test-results") {
      continue;
    }
    const child = path.join(absPath, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectFiles(child)));
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (EXT_ALLOWLIST.has(ext)) out.push(child);
    }
  }

  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

function findMatches(text) {
  const lines = text.split(/\r?\n/);
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (RE.test(lines[i])) matches.push({ line: i + 1, text: lines[i] });
  }
  return matches;
}

async function main() {
  const targets = [];

  for (const d of CHECK_DIRS) {
    targets.push(...(await collectFiles(path.join(ROOT, d))));
  }
  for (const f of CHECK_FILES) {
    targets.push(path.join(ROOT, f));
  }

  const hits = [];
  for (const f of targets) {
    let content;
    try {
      content = await fs.readFile(f, "utf8");
    } catch {
      continue;
    }
    const m = findMatches(content);
    for (const mm of m) hits.push({ file: f, ...mm });
  }

  if (hits.length > 0) {
    console.error("Found disallowed loopback-origin literal(s):");
    for (const h of hits) {
      console.error(`${rel(h.file)}:${h.line}: ${h.text.trim()}`);
    }
    process.exit(1);
  }

  console.log("OK: no loopback-origin literals found in checked files.");
}

await main();
