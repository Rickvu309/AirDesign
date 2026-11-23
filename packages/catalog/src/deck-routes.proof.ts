import type { WireRefusal } from "./index.js"

type Assert<Proof extends true> = Proof

export type UnknownRefusal = Assert<"not-a-refusal" extends WireRefusal ? false : true>
