import fs from "node:fs"

const unitGlobs = [
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  "packages/**/*.test.ts",
  "tests/**/*.test.ts",
  ".agents/skills/**/*.test.mjs",
]

export const testFilesByProject = (root) => {
  const files = { unit: [], api: [], render: [] }
  for (const file of fs
    .globSync(unitGlobs, { cwd: root, exclude: (name) => name === "node_modules" || name === "dist" })
    .sort()) {
    if (file.startsWith("apps/api/")) {
      if (file.endsWith(".test.ts")) files.api.push(file)
    } else if (file.startsWith("packages/render/")) {
      files.render.push(file)
    } else if (!file.startsWith("tests/browser/")) {
      files.unit.push(file)
    }
  }
  return files
}

export const unitSecondsFile = "tests/unit-seconds.json"

export const readUnitSeconds = (root) => JSON.parse(fs.readFileSync(`${root}/${unitSecondsFile}`, "utf8"))
