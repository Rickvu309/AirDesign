import { readStyleName } from "@airdesign/fonts"

type WeightChoices = {
  readonly value: unknown
  readonly choices?: readonly { readonly value: string }[]
}

export function steppedStyle(control: WeightChoices, step: 1 | -1): string | null {
  const current = typeof control.value === "string" ? readStyleName(control.value) : undefined
  if (current === undefined) return null
  const slanted = (control.choices ?? []).flatMap((choice) => {
    const style = readStyleName(choice.value)
    return style === undefined || style.italic !== current.italic ? [] : [{ value: choice.value, weight: style.weight }]
  })
  const next =
    step > 0
      ? slanted.find((choice) => choice.weight > current.weight)
      : slanted.findLast((choice) => choice.weight < current.weight)
  return next?.value ?? null
}
