import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const root = path.join(import.meta.dirname, "..")

it("runs every agent tool without the MCP SDK", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    readonly name: string
    readonly dependencies?: Readonly<Record<string, string>>
    readonly devDependencies?: Readonly<Record<string, string>>
  }
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
  const importing = readdirSync(path.join(root, "src"), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(?:ts|mjs)$/.test(file))
    .filter((file) =>
      /(?:from|import\()\s*["']@modelcontextprotocol\//.test(readFileSync(path.join(root, "src", file), "utf8")),
    )
  expect({
    name: manifest.name,
    declared: declared.filter((name) => name.startsWith("@modelcontextprotocol/")),
    importing,
  }).toEqual({ name: "@airdesign/agent", declared: [], importing: [] })
})
