type Hash = { update(data: string | Uint8Array): Hash; digest(encoding: "hex"): string }
declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
  getBuiltinModule(name: "node:crypto"): { createHash(name: "sha256"): Hash }
}
import {
  openRegister,
  orderKeyBetween,
  slideId,
  type Color,
  type OrderKey,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { orderedParts } from "./slide-order-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

const { readFileSync } = process.getBuiltinModule("node:fs")
const { createHash } = process.getBuiltinModule("node:crypto")

const colors: readonly Color[] = [
  { rgb: "0F2433" },
  { scheme: "accent1" },
  { scheme: "accent2" },
  { scheme: "bg1" },
  { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] },
]

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function digest(parts: Parts): string {
  const hash = createHash("sha256")
  for (const name of [...parts.keys()].sort()) {
    hash.update(name)
    hash.update(parts.get(name) ?? new Uint8Array())
  }
  return hash.digest("hex")
}

function exported(original: Parts, file: readonly SlideId[], order: readonly SlideCommand[]): Parts {
  const register = { ...openRegister("", "deck"), file, order }
  return exportParts(orderedParts(original, register), register)
}

type Run = { readonly digest: string; readonly clones: number; readonly nulls: number; readonly colors: number }

function sequences(original: Parts, count: number, seed: number): Run {
  const file = readSlides(original).map((slide) => slideId(slide.slide))
  const next = random(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
  const all = createHash("sha256")
  let clones = 0
  let nulls = 0
  let painted = 0
  for (let n = 0; n < count; n += 1) {
    const order: SlideCommand[] = []
    const present: SlideId[] = [...file]
    let key: OrderKey | null = null
    let minted = 900
    const length = 1 + Math.floor(next() * 10)
    for (let step = 0; step < length; step += 1) {
      const roll = next()
      if (roll < 0.35) {
        const id = slideId(String(minted++))
        key = orderKeyBetween(key, null)
        order.push({ slide: "clone", id, source: pick(present), key })
        present.push(id)
        clones += 1
      } else if (roll < 0.55) {
        order.push({ slide: "background", id: pick(present), color: null })
        nulls += 1
      } else if (roll < 0.9) {
        order.push({ slide: "background", id: pick(present), color: pick(colors) })
        painted += 1
      } else if (roll < 0.95 && present.length > 1) {
        const id = pick(present)
        order.push({ slide: "remove", id })
        present.splice(present.indexOf(id), 1)
      } else {
        key = orderKeyBetween(key, null)
        order.push({ slide: "move", id: pick(present), key })
      }
    }
    all.update(digest(exported(original, file, order)))
  }
  return { digest: all.digest("hex"), clones, nulls, colors: painted }
}

async function deck(name: string): Promise<Parts> {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
}

const main = [
  {
    deck: "blank.pptx",
    count: 400,
    seed: 7,
    digest: "3939f9fa0d1037d345c2e3d3d76515e022c1533fbbdabda660f2e41203611b31",
    clones: 709,
    nulls: 410,
    colors: 777,
  },
  {
    deck: "nasa-1d-cnn.pptx",
    count: 200,
    seed: 11,
    digest: "1444bee5f26ab921661cc6c537fc329c5ee0817bfbdf6eb58943549badaa4161",
    clones: 393,
    nulls: 215,
    colors: 399,
  },
  {
    deck: "corpus/nasa-earth-gram-tutorial.pptx",
    count: 100,
    seed: 13,
    digest: "de73d2ecb2cc1c745151d12a0bf4649dea43c346d72dedaae604817a0148c8fe",
    clones: 178,
    nulls: 102,
    colors: 211,
  },
] as const

it("exports PR 478's stored background commands byte for byte as main a80f7e51 exported them", async () => {
  for (const recorded of main) {
    const run = sequences(await deck(recorded.deck), recorded.count, recorded.seed)
    expect({ deck: recorded.deck, ...run }).toEqual({
      deck: recorded.deck,
      digest: recorded.digest,
      clones: recorded.clones,
      nulls: recorded.nulls,
      colors: recorded.colors,
    })
  }
}, 120_000)
