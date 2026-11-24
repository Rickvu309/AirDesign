import { readdirSync, writeFileSync } from "node:fs"

const folder = new URL("./src/library/themes/", import.meta.url)
const files = readdirSync(folder)
  .filter((file) => file.endsWith(".json"))
  .sort()
const imports = files.map(
  (file, index) => `import theme${index} from ${JSON.stringify(`./themes/${file}`)} with { type: "json" }`,
)
const entries = files.map((file, index) => `  ${JSON.stringify(file)}: theme${index},`)

writeFileSync(
  new URL("../theme-index.ts", folder),
  [...imports, "", "export const themeFiles: Readonly<Record<string, unknown>> = {", ...entries, "}", ""].join("\n"),
)
