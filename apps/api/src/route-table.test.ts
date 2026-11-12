import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { parseSync } from "oxc-parser"
import { describe, expect, it } from "vitest"

describe("the route table is the only way in", () => {
  const folder = import.meta.dirname

  type Tree = {
    readonly type: string
    readonly start: number
    readonly end: number
    readonly [key: string]: unknown
  }

  type Parsed = { readonly text: string; readonly all: readonly Tree[] }

  function isTree(value: unknown): value is Tree {
    return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
  }

  function walked(root: Tree): Tree[] {
    const children = Object.values(root).flat().filter(isTree)
    return [root, ...children.flatMap(walked)]
  }

  async function parsedFile(name: string): Promise<Parsed> {
    const text = await readFile(path.join(folder, name), "utf8")
    return { text, all: walked(parseSync(name, text, { lang: "ts" }).program as unknown as Tree) }
  }

  function squeezed(text: string): string {
    return text.replace(/\s+/g, "").replace(/,([)}\]])/g, "$1")
  }

  function sourceOf(file: Parsed, node: Tree): string {
    return file.text.slice(node.start, node.end)
  }

  function literalText(node: unknown): string | undefined {
    if (!isTree(node) || node.type !== "Literal" || typeof node.value !== "string") return undefined
    return node.value
  }

  function nameOf(node: unknown): string | undefined {
    if (!isTree(node)) return undefined
    return node.type === "Identifier" && typeof node.name === "string" ? node.name : literalText(node)
  }

  function handleOf(file: Parsed): Tree {
    const handle = file.all.find((node) => node.type === "FunctionDeclaration" && nameOf(node.id) === "handle")
    if (handle === undefined) throw new Error("handle")
    return handle
  }

  const handleSource = `async function handle(context: Context): Promise<void> {
  const { req, res } = context
  let name = "request"
  try {
    const url = readTarget(req.url)
    const route = routes.find(
      (candidate) =>
        candidate.path === url?.pathname && (candidate.method === "any" || candidate.method === req.method),
    )
    const body = bodyOnce(req, route?.cap ?? limits.body)
    if (url === undefined || route === undefined) {
      await body()
      answerNoRoute(res, url)
      return
    }
    name = \`\${route.method} \${route.path}\`
    await route.serve({ ...context, name, query: url.searchParams, body })
  } catch (error) {
    answerThrow(context, name, error)
  }
}`

  it("handle dispatches from the table and has no other branch", async () => {
    const file = await parsedFile("server.ts")
    expect(squeezed(sourceOf(file, handleOf(file)))).toBe(squeezed(handleSource))
  })

  it("createServer does nothing but call handle", async () => {
    const file = await parsedFile("server.ts")
    const calls = file.all.filter((node) => node.type === "CallExpression" && nameOf(node.callee) === "createServer")
    expect(calls.map((call) => squeezed(sourceOf(file, call)))).toEqual([
      "createServer((req,res)=>{voidhandle({options,now,mint,req,res})})",
    ])
  })

  it("server.ts reads the request target only in handle", async () => {
    const file = await parsedFile("server.ts")
    const handle = handleOf(file)
    const read = new Set(["url", "pathname", "href", "originalUrl"])
    const outside = file.all.filter((node) => {
      if (node.start >= handle.start && node.end <= handle.end) return false
      if (node.type === "MemberExpression") {
        return read.has(nameOf(node.property) ?? "")
      }
      return node.type === "Property" && isTree(node.key) && read.has(nameOf(node.key) ?? "")
    })
    expect(outside.map((node) => sourceOf(file, node))).toEqual([])
  })

  it("nothing compares a path outside the table", async () => {
    const file = await parsedFile("server.ts")
    const isPath = (node: unknown): boolean => literalText(node)?.startsWith("/") === true
    const reader = file.all.find((node) => node.type === "FunctionDeclaration" && nameOf(node.id) === "readTarget")
    if (reader === undefined) throw new Error("readTarget")
    const compared = file.all.filter((node) => {
      if (node.start >= reader.start && node.end <= reader.end) return false
      if (node.type === "BinaryExpression") return isPath(node.left) || isPath(node.right)
      if (node.type === "SwitchCase") return isPath(node.test)
      if (node.type !== "CallExpression" || !isTree(node.callee) || node.callee.type !== "MemberExpression")
        return false
      const method = nameOf(node.callee.property) ?? ""
      return ["startsWith", "endsWith", "includes"].includes(method) && isPath((node.arguments as unknown[])[0])
    })
    expect(compared.map((node) => sourceOf(file, node))).toEqual([])
  })

  async function sources(): Promise<readonly string[]> {
    const names = await readdir(folder)
    return names.filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  }

  it("nothing listens for requests by hand", async () => {
    const listeners: string[] = []
    for (const name of await sources()) {
      const file = await parsedFile(name)
      for (const node of file.all) {
        if (node.type !== "CallExpression" || !isTree(node.callee) || node.callee.type !== "MemberExpression") continue
        if (literalText((node.arguments as unknown[])[0]) === "request") listeners.push(sourceOf(file, node))
      }
    }
    expect(listeners).toEqual([])
  })
})
