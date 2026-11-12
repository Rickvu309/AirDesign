export type PrintSize = { readonly width: number; readonly height: number }

const emuPerInch = 914400
const cssPerInch = 96

export function printWidth(size: PrintSize): number {
  return Math.round((size.width / emuPerInch) * cssPerInch)
}

export function pageRule(size: PrintSize): string {
  const inches = (emu: number) => `${Number((emu / emuPerInch).toFixed(4))}in`
  return `@page { size: ${inches(size.width)} ${inches(size.height)}; margin: 0; }`
}
