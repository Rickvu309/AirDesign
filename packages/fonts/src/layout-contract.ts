export const fontLayoutRevision = {
  harfBuzz: "15.0.0",
  harfBuzzPackage: "1.6.4",
  bidiJsPackage: "1.1.0",
  icuReferencePackage: "0.4.0",
  icuWasmSha256: "4017a9d417b52f7b18a9e5b15813484324a2830377b03227c4e6b1396cdac190",
  unicode: "16.0.0",
} as const

type Utf16Range = { readonly start: number; readonly end: number }

type LayoutFace = {
  readonly revision: string
  readonly sha256: string
  readonly faceIndex: number
  readonly axes: Readonly<Record<string, number>>
}

type LayoutRun = {
  readonly range: Utf16Range
  readonly size: number
  readonly tracking: number
  readonly faces: readonly [LayoutFace, ...LayoutFace[]]
}

type LayoutParagraph = {
  readonly text: string
  readonly locale: string
  readonly direction: "ltr" | "rtl" | "auto"
  readonly runs: readonly LayoutRun[]
  readonly sourceOffsetByTextOffset: readonly number[]
}

type LayoutBreaks = {
  readonly graphemes: readonly number[]
  readonly opportunities: readonly number[]
}

type LayoutFaceInterval = {
  readonly range: Utf16Range
  readonly face: LayoutFace
}

type LayoutLine =
  | {
      readonly kind: "shaped"
      readonly range: Utf16Range
      readonly advance: number
      readonly faces: readonly LayoutFaceInterval[]
    }
  | { readonly kind: "unserved"; readonly range: Utf16Range }
  | { readonly kind: "pending"; readonly range: Utf16Range; readonly face: LayoutFace }

export type FontLayout = {
  readonly breaks: (input: Pick<LayoutParagraph, "text" | "locale">) => LayoutBreaks
  readonly shapeLine: (input: {
    readonly paragraph: LayoutParagraph
    readonly range: Utf16Range
    readonly lineEnding: "plain" | "discretionary-hyphen"
  }) => LayoutLine
}
