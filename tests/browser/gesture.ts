import { test } from "@playwright/test"
import type { GestureId } from "../../packages/render/src/index.ts"

export function covers(...ids: readonly GestureId[]): void {
  test.info().annotations.push(...ids.map((id) => ({ type: "gesture", description: id })))
}
