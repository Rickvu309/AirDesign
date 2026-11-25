import { describe, expect, it } from "vitest"
import {
  applyEdit,
  defaultTheme,
  compileAgentChange,
  doomFromTree,
  fontFace,
  isRefusal,
  measureWith,
  orderKeyBetween,
  resolveSlide,
  readEdit,
  readForAgent,
  propOf,
  rev,
  type Text,
} from "../index.js"
import {
  columnComponent,
  expandComponent,
  readComponentSpec,
  type ComponentSpec,
  type ComponentInput,
  type ComponentNode,
  type ComponentTree,
  type PartKey,
} from "./index.js"
import column from "./testing/column.json" with { type: "json" }

const measure = measureWith({})
const dejavu = { ...defaultTheme, fonts: { heading: "DejaVu Sans", body: "DejaVu Sans" } }
const metrics = (digits: number, extra: Readonly<Record<string, number>>) => ({
  ascent: 1901 / 2048,
  descent: 483 / 2048,
  advances: Object.fromEntries(
    [...Array.from("0123456789", (char) => [char, digits] as const), ...Object.entries(extra)].map(([char, width]) => [
      char,
      width / 2048,
    ]),
  ),
})
const exact = measureWith({
  [fontFace("DejaVu Sans", false, false)]: metrics(1303, { F: 1178, Y: 1251, E: 1294, W: 2025, i: 569, " ": 651 }),
  [fontFace("DejaVu Sans", true, false)]: metrics(1425, { "−": 1716, ".": 778 }),
})
const inputs = { ...column, theme: defaultTheme, measure }
const columnInputs = { ...inputs, tokens: { captionSmall: 20 } }
const expand = (spec: ComponentSpec, input: ComponentInput) => {
  const result = expandComponent(spec, input)
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}
const read = (raw: unknown) => {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  return spec
}
const nodes = (input: ComponentInput = columnInputs) => expand(columnComponent, input).children
const part = (nodes: readonly ComponentNode[], ...key: PartKey) =>
  nodes.find((node) => node.key.length === key.length && key.every((segment, index) => node.key[index] === segment))
const specOf = (parts: readonly unknown[]) => ({ version: 1, name: "Fixture", collections: {}, parts })
const measuredText = {
  kind: "text",
  key: ["list", "label"],
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  chars: ["concat", "W".repeat(200), "W".repeat(200)],
  style: "body",
  color: defaultTheme.colors.text,
  align: "left",
  alignV: "top",
  fit: "omit",
}

function land(tree: ComponentTree) {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writesOf = (node: ComponentTree | ComponentNode, parent: unknown) => [
    { node: node.id, prop: "type", value: node.type },
    { node: node.id, prop: "parent", value: parent },
    ...Object.entries(node.props).map(([prop, value]) => ({ node: node.id, prop, value })),
  ]
  let at = orderKeyBetween(null, null)
  const writes = writesOf(tree, { id: slides[0], at })
  for (const child of tree.children) {
    at = orderKeyBetween(at, null)
    writes.push(...writesOf(child, { id: tree.id, at }))
  }
  const edit = readEdit({ once: "component", author: { kind: "person", id: "fixture" }, writes }, doom)
  if (isRefusal(edit)) throw new Error(JSON.stringify(edit))
  const result = applyEdit(doom, { ...edit, rev: rev(2) })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return { doom: result, slide: slides[0]! }
}

describe("component text fitting", () => {
  it("keeps overflowing text only when the emit asks for an ellipsis", () => {
    const filled = expand(read(specOf([{ emit: { ...measuredText, fill: { var: "background" } } }])), {
      ...inputs,
      data: {},
    })
    const bare = expand(read(specOf([{ emit: { ...measuredText, overflow: "ellipsis" } }])), {
      ...inputs,
      data: {},
    })
    expect(filled.children).toEqual([])
    expect(bare.children[0]?.props.text?.overflow).toBe("ellipsis")
    expect(bare.findings).toEqual(filled.findings)
  })

  it("shrinks categories to one size before wrapping and reports labels that cannot fit", () => {
    const frame = { ...column.frame, w: 192 }
    const rows = [
      { id: "shorter", label: "Wi", value: 12 },
      { id: "wrapped", label: "WWWW WWWW", value: 12 },
    ]
    const input = { ...columnInputs, theme: dejavu, measure: exact, frame, data: { rows } }
    const wide = nodes({ ...input, frame: column.frame })
    expect(part(wide, "category", "shorter")?.props.text?.spans[0]?.size).toBeUndefined()
    const tree = expand(columnComponent, input)
    const shorter = part(tree.children, "category", "shorter")
    expect(shorter?.props.text).toMatchObject({ chars: "Wi", spans: [{ size: 20 }] })
    const wrapped = part(tree.children, "category", "wrapped")
    expect(wrapped?.props.text).toMatchObject({ chars: "WWWW WWWW", wrap: "words", spans: [{ size: 20 }] })
    expect(exact(wrapped!.props.text!, dejavu, wrapped!.props.box.w).lines).toHaveLength(2)
    expect(tree.findings).toEqual([])
    const crowded = expand(columnComponent, {
      ...input,
      frame: { ...frame, w: 140 },
      data: { rows: [...rows, { id: "third", label: "Wi", value: 12 }] },
    })
    expect(part(crowded.children, "bar", "wrapped")).toBeDefined()
    expect(crowded.findings).toContainEqual(
      expect.objectContaining({
        kind: "text-fit",
        key: ["categories"],
        thinned: 1,
        field: expect.stringMatching(/\.emit\.chars$/),
      }),
    )
  })

  it("refuses a wrap inside a single word and reports the measured deficit", () => {
    const spec = read(
      specOf([
        {
          emit: {
            ...measuredText,
            chars: "EMEA",
            w: 25,
            h: 80,
            style: "caption",
            fit: { smaller: 18 },
          },
        },
      ]),
    )
    const tree = expand(spec, { ...inputs, data: {} })
    expect(tree.children).toEqual([])
    expect(tree.findings).toEqual([
      expect.objectContaining({
        kind: "text-fit",
        neededWidth: 54,
        availableWidth: 25,
        size: 18,
      }),
    ])
  })

  it("saves plain text and reflows it when the text or font size changes", () => {
    const spec = read(
      specOf([
        {
          emit: {
            ...measuredText,
            chars: "EMEA West",
            w: 59,
            h: 80,
            style: "caption",
            fit: { smaller: 18 },
          },
        },
      ]),
    )
    const fit = measureWith({})
    const tree = expand(spec, { ...inputs, data: {}, measure: fit })
    const child = tree.children[0]!
    const lines = (result: ReturnType<typeof fit>["lines"]) =>
      result.map((line) =>
        line.runs
          .map((run) => run.text)
          .join("")
          .trimEnd(),
      )
    const result = land(tree)
    const painted = resolveSlide(result.doom, result.slide, fit)
      .flatMap((node) => node.children ?? [])
      .find((node) => node.id === child.id)
    expect(readForAgent(result.doom, [result.slide])).toContain('text="EMEA West"')
    expect(lines(painted?.text?.lines ?? [])).toEqual(["EMEA", "West"])
    const chars = "East Mid-market West"
    const writes = compileAgentChange(
      result.doom,
      { op: "set", target: child.id, text: chars, size: 10 },
      () => child.id,
    )
    if ("refused" in writes) throw new Error(JSON.stringify(writes))
    const edited = readEdit({ once: "agent-replace", author: { kind: "person", id: "fixture" }, writes }, result.doom)
    if (isRefusal(edited)) throw new Error(JSON.stringify(edited))
    const saved = applyEdit(result.doom, { ...edited, rev: rev(3) })
    if (isRefusal(saved)) throw new Error(JSON.stringify(saved))
    const editedText = propOf(saved.nodes.get(child.id)!, "text")!
    expect(editedText).toMatchObject({ chars, wrap: "words" })
    expect(lines(fit(editedText, defaultTheme, 65).lines)).toEqual(["East", "Mid-market", "West"])
    expect(lines(fit(editedText, defaultTheme, 120).lines)).toEqual([chars])
  })

  it("uses the smallest spacing that fits and keeps the ends when there is room", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, label: "EMEA", value: i + 1 }))
    const tree = expand(columnComponent, { ...columnInputs, frame: { ...inputs.frame, w: 276 }, data: { rows } })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories.map((node) => node.key[1])).toEqual(["r0", "r2", "r4", "r6"])
    expect(tree.findings.filter((finding) => finding.key[0] === "categories")).toEqual([
      expect.objectContaining({ kind: "text-fit", thinned: 3, neededWidth: 60, size: 20 }),
    ])
    for (const { key, props } of categories) {
      const bar = part(tree.children, "bar", key[1]!)!.props.box
      expect(Math.abs(props.box.x + props.box.w / 2 - (bar.x + bar.w / 2))).toBeLessThanOrEqual(0.5)
    }
  })

  it("starts at row zero and keeps an exact stride when the last lane falls between strides", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, label: "EMEA", value: i + 1 }))
    const width = 312
    const lane = (width - 24) / rows.length
    const tree = expand(columnComponent, { ...columnInputs, frame: { ...inputs.frame, w: width }, data: { rows } })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories.map((node) => node.key[1])).toEqual(["r0", "r2", "r4", "r6"])
    for (const [
      i,
      {
        props: { box },
      },
    ] of categories.entries()) {
      expect(box.x + box.w / 2).toBeCloseTo(12 + (2 * i + 0.5) * lane, 8)
    }
    expect(tree.findings).toContainEqual(
      expect.objectContaining({ key: ["categories"], availableWidth: lane, thinned: 4 }),
    )
  })

  it.each([
    [
      "regional",
      7,
      540,
      ["North America East", "EMEA", "Asia Pacific & Japan", "LatAm", "ANZ", "Greater China", "Middle East & Africa"],
    ],
    [
      "hyphenated",
      20,
      300,
      [
        "Cross-border",
        "Year-over-year growth",
        "Non-interest income",
        "Mid-market",
        "Sub-Saharan Africa",
        "Asia-Pacific",
      ],
    ],
    ["CJK", 100, 300, ["北美东部", "欧洲中东非洲", "亚太及日本地区", "拉丁美洲", "澳新", "大中华区", "中东与非洲"]],
  ] as const)("keeps the %s category axis when the first label needs clamping", (_name, count, width, labels) => {
    const rows = Array.from({ length: count }, (_, i) => ({
      id: `r${i}`,
      label: labels[i % labels.length] + (i >= labels.length ? ` ${i}` : ""),
      value: null,
    }))
    const tree = expand(columnComponent, { ...columnInputs, frame: { ...inputs.frame, w: width }, data: { rows } })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories[0]?.key).toEqual(["category", "r0"])
    expect(categories[0]?.props.box.x).toBe(0)
    const stride = Number(categories[1]?.key[1]?.slice(1) ?? count)
    expect(categories.map(({ key }) => key[1])).toEqual(
      Array.from({ length: Math.ceil(count / stride) }, (_, i) => `r${i * stride}`),
    )
    for (const [
      i,
      {
        props: { box, text },
      },
    ] of categories.entries()) {
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(text?.spans[0]?.size).toBe(20)
      if (i > 0) {
        const previous = categories[i - 1]!.props.box
        expect(box.x - (previous.x + previous.w)).toBeGreaterThanOrEqual(4 - 1e-6)
      }
    }
    expect(tree.findings.filter(({ key }) => key[0] === "categories")).toEqual([
      expect.objectContaining({ thinned: count - categories.length }),
    ])
  })

  it("increases the stride when clamped edge labels collide with a neighbour", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, label: "EMEA", value: i }))
    const width = 184.25
    const tree = expand(columnComponent, { ...columnInputs, frame: { ...inputs.frame, w: width }, data: { rows } })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories.map(({ key }) => key[1])).toEqual(["r0", "r3"])
    expect(categories[0]?.props.box.x).toBe(0)
  })

  it("clamps both edges and leaves the interior label centered", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, label: "EMEA", value: i }))
    const width = 190
    const tree = expand(columnComponent, { ...columnInputs, frame: { ...inputs.frame, w: width }, data: { rows } })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories.map(({ key }) => key[1])).toEqual(["r0", "r2", "r4"])
    const [first, middle, last] = categories.map(({ props }) => props.box)
    expect(first?.x).toBe(0)
    expect(middle!.x + middle!.w / 2).toBeCloseTo(width / 2, 8)
    expect(last!.x + last!.w).toBeCloseTo(width, 8)
  })

  it("keeps a single label if row zero is too wide and reports the frame width if none fits", () => {
    const rows = [
      { id: "r0", label: "W".repeat(20), value: 12 },
      { id: "r1", label: "EMEA", value: 12 },
    ]
    const input = { ...columnInputs, frame: { ...columnInputs.frame, w: 140 }, data: { rows } }
    const tree = expand(columnComponent, input)
    expect(tree.children.filter(({ key }) => key[0] === "category").map(({ key }) => key[1])).toEqual(["r1"])
    const wide = { ...input, data: { rows: [rows[0], { ...rows[1], label: "EMEA".repeat(3) }] } }
    const empty = expand(columnComponent, wide)
    expect(empty.children.filter(({ key }) => key[0] === "category")).toHaveLength(0)
    expect(empty.findings.filter(({ key }) => key[0] === "categories")).toEqual([
      expect.objectContaining({ kind: "text-fit", size: 20, neededWidth: 180, availableWidth: 140, thinned: 2 }),
    ])
  })

  it("counts CJK glyphs as one em in the estimate and fits two lines between characters", () => {
    const spec = read(
      specOf([
        {
          emit: {
            ...measuredText,
            chars: "亚太及日本",
            w: 55,
            h: 80,
            style: "caption",
            fit: { smaller: 18 },
          },
        },
      ]),
    )
    const tree = expand(spec, { ...inputs, data: {} })
    const text = tree.children[0]!.props.text!
    expect(text.chars).toBe("亚太及日本")
    expect(measure(text, defaultTheme, null).w).toBeCloseTo(90)
    expect(measure(text, defaultTheme, 55).lines.map((line) => line.runs.map((run) => run.text).join(""))).toEqual([
      "亚太及",
      "日本",
    ])
  })

  it("keeps an em-sized break when the browser adds subpixel advance", () => {
    const chars = "亚太及日本地区"
    const painted = measureWith({
      [fontFace(defaultTheme.fonts.body, false, false)]: {
        ascent: 0.8,
        descent: 0.2,
        advances: Object.fromEntries([...chars].map((char) => [char, 1.000002])),
      },
    })
    const text = {
      chars,
      spans: [{ end: chars.length, size: 18 }],
      paras: [{}],
      style: "caption",
      resize: "fixed",
      alignV: "center",
      wrap: "words",
    } satisfies Text
    expect(painted(text, defaultTheme, 72).lines.map((line) => line.runs[0]?.text)).toEqual(["亚太及日", "本地区"])
  })

  it("fits the real advance of a thinned Latin estimate when painting uses font metrics", () => {
    const fit = { group: "labels", thin: 4, smaller: 18 }
    const first = { ...measuredText, key: ["list", "first"], chars: "FY53", x: 50, w: 10, h: 70, align: "center", fit }
    const specs = [0, 1, 2].map((i) => ({
      emit: { ...first, x: first.x + i * 22, key: ["list", String(i)] },
    }))
    const spec = read(specOf(specs))
    const tree = expand(spec, {
      ...inputs,
      frame: { ...inputs.frame, w: 180 },
      theme: dejavu,
      data: {},
    })
    const [label] = tree.children
    const result = exact(label!.props.text!, dejavu, label!.props.box.w)
    expect(result.lines[0]!.ink).toBeLessThanOrEqual(label!.props.box.w)
  })

  it("keeps both end labels when the short one leaves room for the long one", () => {
    const fit = { group: "labels", thin: 4, smaller: 18 }
    const spec = read(
      specOf([
        {
          emit: {
            ...measuredText,
            key: ["list", "start"],
            chars: "XXXXXXXXXX",
            x: 57.5,
            w: 30,
            h: 70,
            align: "center",
            fit,
          },
        },
        { emit: { ...measuredText, key: ["list", "end"], chars: "X", x: 140, w: 30, h: 70, align: "center", fit } },
      ]),
    )
    const result = expand(spec, { ...inputs, data: {}, frame: { ...inputs.frame, w: 200 } })
    expect(result.children.map((node) => node.key)).toEqual([["start"], ["end"]])
    expect(result.findings).toEqual([])
  })

  it("widens a thinned label to its measured width without rounding in either direction", () => {
    const fit = { group: "labels", thin: 4, smaller: 18 }
    const first = { ...measuredText, key: ["list", "first"], chars: "FY", x: 6.25, w: 10, h: 70, align: "center", fit }
    const spec = read(specOf([{ emit: first }, { emit: { ...first, key: ["list", "second"], x: 20 } }]))
    const tree = expand(spec, {
      ...inputs,
      frame: { ...inputs.frame, w: 100 },
      data: {},
      theme: dejavu,
      measure: exact,
    })
    const [label] = tree.children
    const box = label!.props.box
    const ink = exact(label!.props.text!, dejavu, box.w).lines[0]!.ink
    expect(tree.children.map(({ key }) => key)).toEqual([["first"]])
    expect(box.w).toBeCloseTo(22.5, 8)
    expect(box.x + box.w / 2).toBeCloseTo(11.25, 8)
    expect(ink).toBeLessThan(box.w)
  })

  it("expands 100 rows with distinct 20-character labels within the work budget", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      label: `Northwest region #${String(i).padStart(2, "0")}`,
      value: i - 40,
    }))
    let fullSizeProbes = 0
    const measure: ComponentInput["measure"] = (text, theme, width, fit) => {
      if (text.style === "caption" && text.chars.startsWith("Northwest") && text.spans[0]?.size === undefined)
        fullSizeProbes += 1
      return exact(text, theme, width, fit)
    }
    const tree = expand(columnComponent, { ...columnInputs, theme: dejavu, measure, data: { rows } })
    expect(tree.children.filter((node) => node.key[0] === "bar")).toHaveLength(rows.length)
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories[0]?.key).toEqual(["category", "r0"])
    expect(tree.findings.filter((finding) => finding.key[0] === "categories")).toEqual([
      expect.objectContaining({ thinned: rows.length - categories.length }),
    ])
    expect(fullSizeProbes).toBe(1)
  })

  it("fits 100 distinct categories when the last one triggers a shared size change", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      label: (i === 99 ? "WWWWWWWWW WWWWWWWW" : "i".repeat(18)) + String(i).padStart(2, "0"),
      value: i - 12345,
    }))
    const tree = expand(columnComponent, {
      ...columnInputs,
      theme: dejavu,
      measure: exact,
      frame: { ...column.frame, w: 18_000 },
      data: { rows },
    })
    const categories = tree.children.filter((node) => node.key[0] === "category")
    expect(categories).toHaveLength(rows.length)
    expect(new Set(categories.map((node) => node.props.text?.spans[0]?.size))).toEqual(new Set([20]))
  })
})
