import { test } from "@playwright/test"
import type { GestureId } from "../../apps/web/src/lib/gestures"

export function covers(...ids: readonly GestureId[]): void {
  test.info().annotations.push(...ids.map((id) => ({ type: "gesture", description: id })))
}
