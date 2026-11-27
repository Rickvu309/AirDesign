import type { Paint } from "./paint.js"

export type RuleLook = { readonly weight: number; readonly ink: Paint }

export type PlacementRules = {
  readonly gapShare: number
  readonly padShare: number
  readonly smallestFreeShare: { readonly w: number; readonly h: number }
  readonly marginShare: number
  readonly edgeShare: number
  readonly freeMarginShare: number
  readonly strokeReachShare: number
  readonly iconSide: number
  readonly iconStrokeDivisor: number
  readonly lineWeight: number
  readonly strokeWeight: number
  readonly table: {
    readonly name: string
    readonly ruleName: string
    readonly totalRow: RegExp
    readonly headerRule: RuleLook
    readonly rowRule: RuleLook
  }
}
