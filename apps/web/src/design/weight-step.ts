import { readStyleName, steppedWeight, styleName, type FontStyle } from "@airdesign/fonts"

type WeightChoices = {
  readonly value: unknown
  readonly choices?: readonly { readonly value: string }[]
}

export function steppedStyle(control: WeightChoices, step: 1 | -1): string | null {
  const current = typeof control.value === "string" ? readStyleName(control.value) : undefined
  if (current === undefined) return null
  const styles = (control.choices ?? []).flatMap((choice): FontStyle[] => {
    const style = readStyleName(choice.value)
    return style === undefined ? [] : [style]
  })
  const next = steppedWeight(current, styles, step)
  return next === null ? null : styleName(next)
}
