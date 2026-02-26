import fs from "node:fs";
import path from "node:path";

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  let normalized = trimmed;
  if (normalized.startsWith("export ")) {
    normalized = normalized.slice("export ".length).trim();
  }

  const eq = normalized.indexOf("=");
  if (eq <= 0) return null;

  const key = normalized.slice(0, eq).trim();
  let value = normalized.slice(eq + 1).trim();
  if (!key) return null;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadEnvFiles(files: string[], rootDir = process.cwd()) {
  for (const file of files) {
    const filePath = path.resolve(rootDir, file);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

export function requireEnv(name: string, hint?: string) {
  const v = process.env[name];
  if (!v) {
    const suffix = hint ? ` ${hint}` : "";
    throw new Error(`Missing required env var: ${name}.${suffix}`);
  }
  return v;
}
