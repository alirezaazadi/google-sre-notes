import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const inputs = ["index.html", "sre-book", "workbook", "assets/claude.css"];
const findings = new Map();

function walk(path) {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).flatMap((name) => walk(join(path, name)));
  }
  return [path];
}

for (const input of inputs.flatMap((path) => walk(join(root, path)))) {
  if (![".css", ".html"].includes(extname(input))) continue;

  const source = readFileSync(input, "utf8");
  const blocks = extname(input) === ".css"
    ? [source]
    : [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);

  for (const css of blocks) {
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const declarations = [...rule[2].matchAll(/(?:^|;)\s*(color|background(?:-color)?):\s*(#[0-9a-f]{3,8})/gi)];
      if (!declarations.length) continue;

      const selector = rule[1].trim().replace(/\s+/g, " ");
      const colors = declarations.map((match) => `${match[1]}:${match[2]}`).join("; ");
      const key = `${selector} { ${colors} }`;
      const files = findings.get(key) || new Set();
      files.add(relative(root, input));
      findings.set(key, files);
    }
  }
}

for (const [rule, files] of [...findings].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`${rule} (${files.size} file${files.size === 1 ? "" : "s"})`);
}

const sharedCss = readFileSync(join(root, "assets/site.css"), "utf8");
const darkBlock = sharedCss.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] || "";
const variables = new Map(
  [...darkBlock.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]),
);

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const contrastPairs = [
  ["ink", "paper"],
  ["ink-soft", "paper"],
  ["marker", "marker-soft"],
  ["coral", "coral-soft"],
  ["moss", "moss-soft"],
];

console.log("\nDark-theme contrast ratios:");
let contrastFailure = false;
for (const [foregroundName, backgroundName] of contrastPairs) {
  const ratio = contrast(variables.get(foregroundName), variables.get(backgroundName));
  console.log(`${foregroundName} on ${backgroundName}: ${ratio.toFixed(2)}:1`);
  if (ratio < 4.5) contrastFailure = true;
}

if (contrastFailure) process.exitCode = 1;
