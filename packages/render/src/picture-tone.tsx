export type CanvasPicture = {
  readonly opacity?: number
  readonly grayscale?: true
  readonly duotone?: readonly [dark: string, light: string]
  readonly blur?: number
  readonly overlay?: string
}
