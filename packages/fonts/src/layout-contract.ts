export const fontLayoutRevision = {
  harfBuzz: "15.0.0",
  harfBuzzPackage: "1.6.4",
  bidiJsPackage: "1.1.0",
  icuReferencePackage: "0.4.0",
  icuWasmSha256: "4017a9d417b52f7b18a9e5b15813484324a2830377b03227c4e6b1396cdac190",
  icuBreakerSha256: "2cff0a59a1d6f81218392b47b2971c36d86468d0036c1c450fee4e6f168007ad",
  unicode: "16.0.0",
} as const

type Utf16Range = { readonly start: number; readonly end: number }

export type LayoutFace = {
  readonly revision: string
  readonly sha256: string
  readonly faceIndex: number
  readonly axes: Readonly<Record<string, number>>
  readonly presentation?: "color" | "text"
}

type LayoutRun = {
  readonly range: Utf16Range
  readonly size: number
  readonly tracking: number
  readonly figures?: "tabular"
  readonly faces: readonly [LayoutFace, ...LayoutFace[]]
  readonly stack?: string
  readonly fallback?: (cluster: string, presentation: "text" | "color" | undefined) => Iterable<LayoutFace | "loading">
}

export type LayoutParagraph = {
  readonly text: string
  readonly locale: string
  readonly direction: "ltr" | "rtl" | "auto"
  readonly runs: readonly LayoutRun[]
  readonly sourceOffsetByTextOffset: readonly number[]
}

export type LayoutBreaks = {
  readonly graphemes: readonly number[]
  readonly opportunities: readonly number[]
}

type LayoutFaceInterval = {
  readonly range: Utf16Range
  readonly face: LayoutFace
}

export type ShapedLine = {
  readonly kind: "shaped"
  readonly range: Utf16Range
  readonly advance: number
  readonly faces: readonly LayoutFaceInterval[]
  readonly glyphs: readonly LayoutGlyph[]
  readonly display?: string
}

export type LayoutLine =
  | ShapedLine
  | { readonly kind: "unserved"; readonly range: Utf16Range }
  | { readonly kind: "pending"; readonly range: Utf16Range; readonly face: LayoutFace }

export type FontLayout = {
  readonly breaks: (input: Pick<LayoutParagraph, "text" | "locale">) => LayoutBreaks
  readonly shapeLine: (input: {
    readonly paragraph: LayoutParagraph
    readonly range: Utf16Range
    readonly lineEnding: "plain" | "discretionary-hyphen"
    readonly missingFace?: LayoutFace
    readonly contextualSpacing?: boolean
  }) => LayoutLine
}

export type LayoutGlyph = {
  readonly cluster: number
  readonly id: number
  readonly unsafeToBreak: boolean
}

export type FaceAsset = {
  readonly revision: string
  readonly key: string
  readonly axes: LayoutFace["axes"]
  readonly faceIndex?: number
  readonly read: () => Promise<Uint8Array<ArrayBuffer>>
  readonly onEvict?: () => void
}

export type FontLayoutEngine = FontLayout & {
  readonly prepareFace: (asset: FaceAsset) => Promise<LayoutFace>
  readonly pinFace: (revision: string, key: string, priority?: number) => () => void
  readonly hasFace: (face: LayoutFace) => boolean
  readonly cache: () => { readonly bytes: number; readonly faces: number; readonly evictions: number }
  readonly flow: (input: {
    readonly paragraph: LayoutParagraph
    readonly width: number
    readonly emergency: boolean
    readonly twoLines: boolean
    readonly missingFace: LayoutFace
  }) =>
    | {
        readonly direction: "ltr" | "rtl"
        readonly lines: readonly ShapedLine[]
        readonly twoLineWidth?: number
      }
    | undefined
}
