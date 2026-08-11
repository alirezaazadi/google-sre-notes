import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const books = ["sre-book", "workbook"];

function htmlFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /^\d{2}-.+\.html$/.test(name))
    .sort();
}

function chapterNumber(filename) {
  return filename.slice(0, 2);
}

function replaceAllLiteral(source, search, replacement) {
  return source.split(search).join(replacement);
}

function injectAssets(file, assetPrefix, version = "", counterpart = "") {
  let html = readFileSync(file, "utf8");
  const assets = [];

  if (!html.includes("data-site-favicon")) {
    assets.push(`  <link rel="icon" href="${assetPrefix}/favicon.svg" type="image/svg+xml" data-site-favicon>`);
  }

  if (!html.includes("data-site-controls")) {
    const versionAttribute = version ? ` data-summary-version="${version}"` : "";
    const counterpartAttribute = counterpart ? ` data-counterpart="${counterpart}"` : "";
    assets.push(
      `  <link rel="stylesheet" href="${assetPrefix}/site.css" data-site-controls>`,
      `  <script src="${assetPrefix}/site.js"${versionAttribute}${counterpartAttribute} data-site-controls></script>`,
    );
  }

  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1">`);
  }

  if (assets.length) html = html.replace(/<\/head>/i, `${assets.join("\n")}\n</head>`);
  writeFileSync(file, html);
}

mkdirSync(join(root, "versions", "claude"), { recursive: true });

const counterparts = new Map();

for (const book of books) {
  const gptDirectory = join(root, book);
  const sourceDirectory = join(root, "sre-books-explained", book);
  const claudeDirectory = join(root, "versions", "claude", book);
  const gptByChapter = new Map(htmlFiles(gptDirectory).map((name) => [chapterNumber(name), name]));
  const sourceFiles = htmlFiles(sourceDirectory);

  mkdirSync(claudeDirectory, { recursive: true });

  if (sourceFiles.length) {
    const names = new Map();
    for (const oldName of sourceFiles) {
      const newName = gptByChapter.get(chapterNumber(oldName));
      if (!newName) throw new Error(`No GPT chapter matches ${book}/${oldName}`);
      names.set(oldName, newName);
    }

    for (const oldName of sourceFiles) {
      let html = readFileSync(join(sourceDirectory, oldName), "utf8");
      for (const [from, to] of names) {
        html = replaceAllLiteral(html, `href="${from}"`, `href="${to}"`);
      }
      html = replaceAllLiteral(html, 'href="../assets/style.css"', 'href="../../../assets/claude.css"');

      const destination = join(claudeDirectory, names.get(oldName));
      writeFileSync(destination, html);
    }
  }

  for (const claudeName of htmlFiles(claudeDirectory)) {
    const gptName = gptByChapter.get(chapterNumber(claudeName));
    if (gptName) counterparts.set(`${book}/${gptName}`, `versions/claude/${book}/${claudeName}`);
  }
}

const oldStyle = join(root, "sre-books-explained", "assets", "style.css");
const claudeStyle = join(root, "assets", "claude.css");
if (existsSync(oldStyle) && !existsSync(claudeStyle)) renameSync(oldStyle, claudeStyle);

injectAssets(join(root, "index.html"), "assets");

for (const book of books) {
  const indexFile = join(root, book, "index.html");
  if (existsSync(indexFile)) injectAssets(indexFile, "../assets");

  for (const filename of htmlFiles(join(root, book))) {
    const key = `${book}/${filename}`;
    const claudePath = counterparts.get(key);
    const counterpart = claudePath ? `../${claudePath}` : "";
    injectAssets(join(root, key), "../assets", "gpt", counterpart);
  }

  for (const filename of htmlFiles(join(root, "versions", "claude", book))) {
    injectAssets(
      join(root, "versions", "claude", book, filename),
      "../../../assets",
      "claude",
      `../../../${book}/${filename}`,
    );
  }
}

if (existsSync(join(root, "sre-books-explained"))) {
  rmSync(join(root, "sre-books-explained"), { recursive: true });
}

console.log(`Integrated ${counterparts.size} Claude chapter counterparts.`);
