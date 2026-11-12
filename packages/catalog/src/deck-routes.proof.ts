import type { Reach } from "@airdesign/device"
import type { Refusal } from "@airdesign/document"
import type { CallRefusal, WireRefusal, readCommit } from "./index.js"

type Assert<Proof extends true> = Proof

type Refused<Result> = Result extends { ok: false; refusal: infer Code } ? Code : never

export type UnknownRefusal = Assert<"not-a-refusal" extends WireRefusal ? false : true>
export type DocumentRefusals = Assert<Exclude<Refusal, WireRefusal> extends never ? true : false>
export type DeviceRefusals = Assert<Exclude<Exclude<Reach, "ready">, WireRefusal> extends never ? true : false>
export type CommitRefusals = Assert<
  Exclude<Refused<ReturnType<typeof readCommit>>, CallRefusal> extends never ? true : false
>
