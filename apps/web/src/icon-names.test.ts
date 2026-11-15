import { iconNames, knownIcon } from "@airdesign/catalog"
import { expect, it } from "vitest"

type Fs = {
  readdirSync(path: string): readonly string[]
  readFileSync(path: string, encoding: "utf8"): string
}

it("names every Lucide icon the app ships, and no alias, so the server checks a name the device can draw", async () => {
  const fsName = "node:fs"
  const fs = (await import(fsName)) as Fs
  const folder = new URL("../node_modules/lucide-react/dist/esm/icons/", import.meta.url).pathname
  const shipped = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".mjs") && fs.readFileSync(`${folder}${file}`, "utf8").includes("__iconData = {"))
    .map((file) => file.slice(0, -".mjs".length))
    .sort()
  expect(iconNames).toEqual(shipped)
  expect(knownIcon("rocket")).toBe(true)
  expect(knownIcon("alert-circle")).toBe(false)
})
