import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

const patterns = [
  "bg-white",
  "bg-zinc-50",
  "bg-zinc-100",
  "text-zinc-900",
  "text-zinc-800",
  "text-zinc-700",
  "text-zinc-600",
  "text-zinc-500",
  "border-zinc-200",
  "border-zinc-100",
  "ring-zinc",
];

const excludedPrefixes = [
  "src/screens/auth/",
];

const excludedFiles = new Set([
  "src/screens/LandingScreen.tsx",
  "src/screens/PrivacyPolicyScreen.tsx",
  "src/screens/SharedFolderPage.tsx",
]);

function collectSourceFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const path = `${directory}/${entry}`;
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    if (excludedFiles.has(path)) continue;
    if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) continue;

    files.push(path);
  }

  return files;
}

const files = collectSourceFiles("src");

const matches = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (line.includes(pattern)) {
        matches.push({
          file,
          line: index + 1,
          pattern,
          text: line.trim(),
        });
      }
    }
  });
}

if (matches.length === 0) {
  console.log("No raw light-mode Tailwind color usages found in authenticated app source.");
  process.exit(0);
}

console.log(`Found ${matches.length} raw light-mode Tailwind color usages:\n`);
for (const match of matches) {
  console.log(`${relative(process.cwd(), match.file)}:${match.line} ${match.pattern}`);
  console.log(`  ${match.text}`);
}

process.exit(0);
