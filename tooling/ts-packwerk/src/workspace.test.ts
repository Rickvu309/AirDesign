import { afterEach, describe, expect, it } from "vitest"
import { app, makeRepo, type Repo } from "./fixture.ts"
import { loadWorkspace, packOf } from "./workspace.ts"

let repo: Repo
afterEach(() => repo.remove())

const open = async (extra: Record<string, string> = {}) => {
  repo = makeRepo({ ...app, ...extra })
  repo.link("apps/web/node_modules/@acme/core", "packages/core")
  return loadWorkspace(repo.root)
}

const reference = (workspace: Awaited<ReturnType<typeof open>>, file: string, specifier: string) =>
  workspace.references.find((item) => item.file === file && item.specifier === specifier)

describe("loadWorkspace", () => {
  it("lists the included files and the packs that own them", async () => {
    const workspace = await open()
    expect(workspace.problems).toEqual([])
    expect(workspace.files).toContain("apps/web/src/editor/editor.ts")
    expect(workspace.files).not.toContain("packages/core/dist/index.js")
    expect(workspace.packs.map((pack) => pack.name)).toEqual([
      "apps/web/src",
      "apps/web/src/editor",
      "apps/web/src/kit",
    ])
    expect(packOf(workspace.packs, "apps/web/src/editor/lazy.ts")?.name).toBe("apps/web/src/editor")
    expect(packOf(workspace.packs, "apps/web/src/main.ts")?.name).toBe("apps/web/src")
    expect(packOf(workspace.packs, "packages/core/src/index.ts")).toBeUndefined()
    expect(workspace.packageRoots).toEqual(["apps/web", "packages/core"])
  })

  it("defaults a pack's public path to its index file", async () => {
    const workspace = await open({ "apps/web/src/kit/pack.yml": "layer: platform\n" })
    expect(workspace.packs.find((pack) => pack.name === "apps/web/src/kit")?.publicPaths).toEqual([
      "apps/web/src/kit/index.ts",
    ])
  })

  it("resolves relative, aliased, workspace, external and builtin references", async () => {
    const workspace = await open()
    expect(reference(workspace, "apps/web/src/editor/editor.ts", "../kit/index.js")).toMatchObject({
      line: 1,
      column: 24,
      typeOnly: false,
      target: { kind: "file", file: "apps/web/src/kit/index.ts" },
    })
    expect(reference(workspace, "apps/web/src/editor/editor.ts", "../kit/theme.js")).toMatchObject({ typeOnly: true })
    expect(reference(workspace, "apps/web/src/main.ts", "@/editor/index.js")?.target).toEqual({
      kind: "file",
      file: "apps/web/src/editor/index.ts",
    })
    expect(reference(workspace, "apps/web/src/main.ts", "@acme/core")?.target).toEqual({
      kind: "file",
      file: "packages/core/src/index.ts",
    })
    expect(reference(workspace, "apps/web/src/editor/editor.ts", "node:fs")?.target).toEqual({ kind: "builtin" })
    expect(reference(workspace, "apps/web/src/editor/editor.ts", "./lazy.js")?.target).toEqual({
      kind: "file",
      file: "apps/web/src/editor/lazy.ts",
    })
  })

  it("says whether an external package is declared, and how", async () => {
    const workspace = await open({
      "apps/web/src/kit/index.ts":
        'import "react"\nimport { it } from "vitest"\nimport left from "left-pad"\nexport const button = [it, left]\n',
    })
    const kit = "apps/web/src/kit/index.ts"
    expect(reference(workspace, kit, "react")?.target).toEqual({ kind: "package", name: "react", declared: "runtime" })
    expect(reference(workspace, kit, "vitest")?.target).toEqual({ kind: "package", name: "vitest", declared: "dev" })
    expect(reference(workspace, kit, "left-pad")?.target).toEqual({
      kind: "package",
      name: "left-pad",
      declared: "missing",
    })
  })

  it("reports manifest problems instead of guessing", async () => {
    const workspace = await open({
      "apps/web/src/kit/pack.yml": "layer: nowhere\ndependencies: [apps/web/src/ghost]\npublic: [missing.ts]\n",
    })
    expect(workspace.problems).toEqual([
      "apps/web/src/kit/pack.yml layer nowhere is not one of packwerk.yml layers",
      "apps/web/src/kit/pack.yml public path apps/web/src/kit/missing.ts does not exist",
      "apps/web/src/kit/pack.yml depends on apps/web/src/ghost, which is not a pack",
    ])
  })
})
