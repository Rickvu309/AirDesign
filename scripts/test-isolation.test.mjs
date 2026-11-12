import path from "node:path"
import { fileURLToPath } from "node:url"
import { isolationReasons, splitUnitTests } from "./test-isolation.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const isolated = {
  "a module mock": `import { vi } from "vitest"\nvi.mock("./a")\n`,
  "an aliased vi": `import { vi as v } from "vitest"\nv.mock("./a")\n`,
  "a namespace import": `import * as vitest from "vitest"\nvitest.vi.stubGlobal("x", 1)\n`,
  "a default alias": `import { vi } from "vitest"\nconst mocker = vi\nmocker.spyOn(a, "b")\n`,
  "a dynamic import": `const { vi } = await import("vitest")\nvi.useFakeTimers()\n`,
  "a destructured member": `import { vi } from "vitest"\nconst { stubGlobal } = vi\nstubGlobal("x", 1)\n`,
  "vi.doMock": `import { vi } from "vitest"\nvi.doMock("./a", () => ({}))\n`,
  "vi.hoisted": `import { vi } from "vitest"\nconst h = vi.hoisted(() => 1)\n`,
  "vi.stubEnv": `import { vi } from "vitest"\nvi.stubEnv("A", "1")\n`,
  "vi.setSystemTime": `import { vi } from "vitest"\nvi.setSystemTime(0)\n`,
  "vi.resetModules": `import { vi } from "vitest"\nvi.resetModules()\n`,
  "vi.importActual": `import { vi } from "vitest"\nawait vi.importActual("./a")\n`,
  "a computed member": `import { vi } from "vitest"\nvi["mock"]("./a")\n`,
  "vi handed to a function": `import { vi } from "vitest"\ninstall(vi)\n`,
  "the global vi": `vi.spyOn(console, "log")\n`,
  "a global assigned": `globalThis.fetch = () => 1\n`,
  "an env assigned": `process.env.A = "1"\n`,
  "an env deleted": `delete process.env.A\n`,
  "a global defined": `Object.defineProperty(globalThis, "x", { value: 1 })\n`,
}
for (const [name, text] of Object.entries(isolated)) {
  if (isolationReasons(text).length === 0) fail(`${name} would share workers`)
}

const shared = {
  "plain tests": `import { it, expect } from "vitest"\nit("a", () => expect(1).toBe(1))\n`,
  "a bare mock function": `import { vi } from "vitest"\nconst f = vi.fn()\nf()\nexpect(vi.mocked(f)).toBeDefined()\nawait vi.waitFor(() => 1)\n`,
  "a mention in a string": `const s = "vi.mock(x)"\n`,
  "a local called vi": `const other = { mock: 1 }\nconst x = other.mock\n`,
  "a read of the environment": `const a = process.env.A\n`,
  "a write to a local": `const local = {}\nlocal.a = 1\n`,
}
for (const [name, text] of Object.entries(shared)) {
  const reasons = isolationReasons(text)
  if (reasons.length > 0) fail(`${name} was isolated for ${reasons.join(", ")}`)
}

const { shared: sharedFiles, isolated: isolatedFiles } = splitUnitTests(root)
if (sharedFiles.length < 50) fail(`only ${sharedFiles.length} files share workers`)
for (const file of sharedFiles) {
  if (isolatedFiles.includes(file)) fail(`${file} is in both groups`)
}

const config = (await import(path.join(root, "vitest.config.mts"))).default
const projects = config.test.projects
const included = (name) => projects.find((project) => project.test.name === name).test.include
const asList = (list) => JSON.stringify([...list].sort())
if (asList(included("shared")) !== asList(sharedFiles)) fail("vitest.config.mts does not run the shared files this scan chose")
if (asList(included("unit")) !== asList(isolatedFiles)) fail("vitest.config.mts does not isolate the files this scan chose")
if (projects.find((project) => project.test.name === "shared").test.isolate !== false) fail("the shared project isolates")

console.log("test isolation tests passed")
