import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteFiles = ["index.html", "styles.css", "app.js", "game.js", "sound.js"];
const missingSiteFiles = siteFiles.filter((file) => !fs.existsSync(path.join(root, file)));

if (missingSiteFiles.length) {
  console.error(`Missing site files: ${missingSiteFiles.join(", ")}`);
  process.exit(1);
}

const sources = Object.fromEntries(
  siteFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
);

const localOnlyPattern = /(?:127\.0\.0\.1|localhost|file:\/\/)/i;
const localOnlyFiles = siteFiles.filter((file) => localOnlyPattern.test(sources[file]));

if (localOnlyFiles.length) {
  console.error(`Local-only URL found in: ${localOnlyFiles.join(", ")}`);
  process.exit(1);
}

const references = new Set();

for (const match of sources["index.html"].matchAll(/(?:src|href)="([^"]+)"/g)) {
  references.add(match[1]);
}

for (const match of sources["styles.css"].matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
  references.add(match[2]);
}

for (const file of ["app.js", "game.js", "sound.js"]) {
  for (const match of sources[file].matchAll(/(['"])(assets\/[^'"]+)\1/g)) {
    references.add(match[2]);
  }
}

const localReferences = [...references].filter(
  (reference) =>
    !reference.startsWith("#") &&
    !reference.startsWith("data:") &&
    !reference.startsWith("http://") &&
    !reference.startsWith("https://"),
);
const rootAbsoluteReferences = localReferences.filter((reference) => reference.startsWith("/"));
const missingReferences = localReferences.filter(
  (reference) => !fs.existsSync(path.resolve(root, reference.split(/[?#]/, 1)[0])),
);

if (rootAbsoluteReferences.length || missingReferences.length) {
  if (rootAbsoluteReferences.length) {
    console.error(`Root-absolute references are not project-page safe: ${rootAbsoluteReferences.join(", ")}`);
  }
  if (missingReferences.length) {
    console.error(`Missing local references: ${missingReferences.join(", ")}`);
  }
  process.exit(1);
}

console.log(`Static site check passed: ${localReferences.length} local references resolved.`);
