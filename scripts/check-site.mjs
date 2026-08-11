import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (name === ".git") return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const pages = walk(root).filter((file) => file.endsWith(".html"));

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const pageName = relative(root, page);
  const controls = html.match(/data-site-controls/g) || [];

  if (controls.length !== 2) {
    errors.push(`${pageName}: expected the shared stylesheet and script`);
  }

  const favicons = html.match(/data-site-favicon/g) || [];
  if (favicons.length !== 1) {
    errors.push(`${pageName}: expected exactly one shared favicon`);
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (/^(?:[a-z]+:|#|\/\/)/i.test(value)) continue;
    const localPath = resolve(dirname(page), value.split(/[?#]/, 1)[0]);
    if (!existsSync(localPath)) errors.push(`${pageName}: broken local reference ${value}`);
  }

  const version = html.match(/data-summary-version="(gpt|claude)"/)?.[1];
  const counterpart = html.match(/data-counterpart="([^"]+)"/)?.[1];
  if (version && counterpart) {
    const target = resolve(dirname(page), counterpart);
    if (!existsSync(target)) {
      errors.push(`${pageName}: missing ${version} counterpart ${counterpart}`);
    } else {
      const expectedVersion = version === "gpt" ? "claude" : "gpt";
      const targetHtml = readFileSync(target, "utf8");
      if (!targetHtml.includes(`data-summary-version="${expectedVersion}"`)) {
        errors.push(`${pageName}: counterpart is not marked as ${expectedVersion}`);
      }
    }
  }
}

if (existsSync(join(root, "sre-books-explained"))) {
  errors.push("The old sre-books-explained directory still exists");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const claudePages = pages.filter((page) => page.includes("/versions/claude/")).length;
  console.log(`Checked ${pages.length} pages, including ${claudePages} Claude counterparts.`);
}
