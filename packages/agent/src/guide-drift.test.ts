import { catalog, projectTools, readCreateDeck, toolInputSchema } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import ts from "typescript-api"
import { expect, it } from "vitest"

import { verbFields } from "./execute-ops.js"
import { guides } from "./guides.js"
import { callTool, type DeckHost } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const operations = new Map(Object.entries(verbFields))
operations.set("createDeck", Object.keys(readCreateDeck.input.shape))
const tools = new Map(projectTools(catalog).map(({ name, op }) => [name, toolInputSchema(op)]))

const codeSpans = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map(([, code]) => code!)
const fields = (text: string) => text.match(/\w+/g) ?? []
const keys = (value: unknown) => (typeof value === "object" && value !== null ? Object.keys(value) : [])

function nodesOf(code: string) {
  const file = ts.createSourceFile("guide.js", code, ts.ScriptTarget.Latest, true)
  const nodes: ts.Node[] = []
  function visit(node: ts.Node) {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return nodes
}

function checkCalls(code: string, guide: string, getFields: (targeted: boolean) => readonly unknown[]) {
  const nodes = nodesOf(code)
  const locals = new Set(
    nodes.flatMap((node) =>
      (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)
        ? [node.name.text]
        : [],
    ),
  )
  for (const node of nodes) {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) continue
    const op = node.expression.text
    if (locals.has(op) || op === "print") continue
    const allowed = operations.get(op) ?? keys(tools.get(op)?.properties)
    expect(operations.has(op) || tools.has(op), `${guide}: operation or tool ${op}`).toBe(true)
    const input = node.arguments[0]
    const supplied =
      input !== undefined && ts.isObjectLiteralExpression(input)
        ? input.properties.flatMap(({ name }) =>
            name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? [name.text] : [],
          )
        : []
    for (const field of supplied) expect(allowed, `${guide}: ${op} input`).toContain(field)
    if (op === "get" && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node)
      expect(getFields(supplied.includes("target")), `${guide}: get answer`).toContain(node.parent.name.text)
  }
}

it("keeps every guide's tool, operation, input and answer references on the agent contract", async () => {
  const fold = () =>
    doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: Array.from({ length: 12 }, () => ({
        children: [{ type: "shape", props: { text: doom.textFromMarkdown("word ".repeat(1_200).trim(), "body") } }],
      })),
    }).doom
  const host: DeckHost = {
    ...memoryDecks(fold),
    screenshots: async (_deck, _fold, slides) => new Map(slides.map((slide) => [slide, "QUFB"])),
  }
  const session = { agent: "guide-drift", mint: () => "create" }
  const created = await callTool("airdesign_execute", { script: "createDeck()" }, session, host)
  expect(created.ok, JSON.stringify(created.fields)).toBe(true)
  const answer = await callTool(
    "airdesign_execute",
    {
      deck: created.fields.deck,
      script: `
        const slide = insert({ kind: "slide" })
        const layer = insert({ kind: "text", parent: slide, name: "Title", text: "Hello" })
        screenshot({ target: slide })
        print("done")
        ;[Object.keys(get()), Object.keys(get({ target: layer }))]
      `,
    },
    { ...session, once: "guide-drift" },
    host,
  )
  expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
  const result = answer.fields.result
  if (!Array.isArray(result)) throw new Error("Expected deck and layer answer fields")
  const [deckFields, layerFields]: unknown[] = result
  const getFields = (targeted: boolean): readonly unknown[] => {
    const returned = targeted ? layerFields : deckFields
    if (!Array.isArray(returned)) throw new Error("Expected a list of get answer fields")
    return returned
  }

  for (const { name, description, markdown } of guides()) {
    const prose = `${description}\n${markdown.replace(/\x60{3}js\n([\s\S]*?)\x60{3}/g, (_, code: string) => {
      checkCalls(code, name, getFields)
      return ""
    })}`
    for (const tool of prose.match(/\bairdesign_\w+\b/g) ?? []) {
      expect(tools.has(tool), name).toBe(true)
    }
    for (const [, op] of prose.matchAll(/`(\w+)`\s+(?:op|operation)\b/g))
      expect(operations.has(op!), `${name}: operation ${op}`).toBe(true)
    for (const [, tool, input] of prose.matchAll(/`(airdesign_\w+)`[^\n.]*\. Send `(\{[^}]+\})`/g))
      checkCalls(`${tool}(${input!.replaceAll(/\?(?=[,}\s])/g, "")})`, name, getFields)
    for (const code of codeSpans(prose)) {
      if (/^\w+\(/.test(code))
        checkCalls(code.replaceAll(/\?(?=[,}\s])/g, "").replaceAll(/\bor\b/g, ","), name, getFields)
      else if (/^airdesign_\w+\s*\{/.test(code))
        checkCalls(code.replace(/^(\w+)\s*/, "$1(").replaceAll(/<\w+>/g, "value") + ")", name, getFields)
    }
    for (const [, target, returned, optional] of prose.matchAll(
      /`get\((.*?)\)` returns [^\n`]*`\{([^}]+)\}`(?:, with `(\w+)`)?/g,
    )) {
      for (const field of [...fields(returned!), ...(optional === undefined ? [] : [optional])])
        expect(getFields(target !== ""), `${name}: get answer`).toContain(field)
    }

    const answerSection = prose.split(/^## The answer\n/m)[1]?.split(/^## /m)[0] ?? ""
    for (const line of answerSection.split("\n")) {
      const listed = line.match(/^- (?:Send )?((?:`\w+`(?:, | and )?)+)/)?.[1] ?? ""
      for (const field of codeSpans(listed)) expect(keys(answer.fields), `${name}: execute answer`).toContain(field)
      const nested = line.match(/^- `(\w+)` .+ as `\{([^}]+)\}`/)
      if (nested === null) continue
      const items = answer.fields[nested[1]!]
      const allowed = Array.isArray(items) ? keys(items[0]) : []
      for (const field of fields(nested[2]!)) expect(allowed, `${name}: execute answer ${nested[1]}`).toContain(field)
    }
  }
})
