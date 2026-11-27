import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const folder = import.meta.dirname

it("mounts the MCP door without reaching deck tables, accounts or the platform", () => {
  const reaching = readdirSync(folder)
    .filter((file) => /\.(?:ts|yml)$/.test(file))
    .flatMap((file) =>
      [
        ...readFileSync(path.join(folder, file), "utf8").matchAll(
          /(?:\.\.\/|apps\/api\/src\/)(doom|account|platform)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]!}`),
    )
  expect(reaching).toEqual([])
})
