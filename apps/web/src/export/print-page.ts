export type SlideSize = { readonly w: number; readonly h: number }

export const printWidth = 1280

const cssPerInch = 96

export function printHeight(size: SlideSize): number {
  return Math.round((printWidth * size.h) / size.w)
}

export function pageRule(size: SlideSize): string {
  const inches = (px: number) => `${String(Number((px / cssPerInch).toFixed(4)))}in`
  return `@page { size: ${inches(printWidth)} ${inches((printWidth * size.h) / size.w)}; margin: 0; }`
}
