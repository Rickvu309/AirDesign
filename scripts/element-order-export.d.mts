export function elementOrderLines(answers: {
  readonly pptx: object
  readonly parts: ReadonlyMap<string, ReadonlyMap<string, Uint8Array>>
}): readonly string[]
