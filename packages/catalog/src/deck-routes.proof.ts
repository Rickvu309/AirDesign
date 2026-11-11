import type { WireRefusal } from "./index.js"
import type { Refusal } from "@airdesign/document"

type Assert<Proof extends true> = Proof

export type UnknownRefusal = Assert<"not-a-refusal" extends WireRefusal ? false : true>
export type DocumentRefusals = Assert<Exclude<Refusal, WireRefusal> extends never ? true : false>

export const refusalHandlers = {
  stale: true,
  "person-protected": true,
  "run-fenced": true,
  dead: true,
  present: true,
  limit: true,
  field: true,
  deck: true,
  batch: true,
  base: true,
  payload: true,
  cursor: true,
  session: true,
  owner: true,
  storage: true,
  missing: true,
  size: true,
  server: true,
  code: true,
  store: true,
  "text-from": true,
  device: true,
  "no-open-tab": true,
  "tab-hidden": true,
  "tab-timeout": true,
  "tab-outdated": true,
} satisfies Record<WireRefusal, true>

export type MissingHandler = Assert<
  Omit<typeof refusalHandlers, "payload"> extends Record<WireRefusal, true> ? false : true
>
