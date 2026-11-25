import { bytesOf } from "../limits.js"
import { reject } from "../read-kit.js"
import { isRefusal } from "../refusal.js"
import { readComponentSpec } from "./spec.js"
import { record } from "./values.js"

export type StoredSpec = Readonly<Record<string, unknown>>

export function readStoredSpec(raw: unknown): StoredSpec {
  const spec = record(raw)
  const encoded = JSON.stringify(spec)
  if (bytesOf(encoded) > 32_000) return reject("limit")
  const stored: unknown = JSON.parse(encoded)
  const read = readComponentSpec(stored)
  if (isRefusal(read)) return reject(read.refused === "limit" ? "limit" : "shape")
  return record(stored)
}
