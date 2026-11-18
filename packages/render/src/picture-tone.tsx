export type CanvasPicture = {
  readonly opacity?: number
  readonly grayscale?: true
  readonly duotone?: readonly [dark: string, light: string]
  readonly blur?: number
  readonly overlay?: string
}

const luminance = "0.2126 0.7152 0.0722 0 0"

function channels(hex: string): readonly number[] {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16)
  return [16, 8, 0].map((shift) => ((value >> shift) & 255) / 255)
}

export function ToneFilter(props: { readonly id: string; readonly duotone: readonly [dark: string, light: string] }) {
  const dark = channels(props.duotone[0])
  const light = channels(props.duotone[1])
  const table = (channel: number) => `${String(dark[channel] ?? 0)} ${String(light[channel] ?? 1)}`
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id={props.id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`${luminance} ${luminance} ${luminance} 0 0 0 1 0`} />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}
