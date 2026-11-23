import type { Reach } from "@airdesign/device"
import type { Refusal } from "@airdesign/document"
import type { WireRefusal } from "./index.js"

type Assert<Proof extends true> = Proof

export type UnknownRefusal = Assert<"not-a-refusal" extends WireRefusal ? false : true>
export type DocumentRefusals = Assert<Exclude<Refusal, WireRefusal> extends never ? true : false>
export type DeviceRefusals = Assert<Exclude<Exclude<Reach, "ready">, WireRefusal> extends never ? true : false>
