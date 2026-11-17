import { expect, test } from "@playwright/test"

test("picture copy loads for the Grid tools after the picture controls", async () => {
  const { picturePanelCopy } = await import("../../apps/web/src/copy/picture-panel-copy.ts")
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy.ts")
  expect(pictureCopy.section).toBe(picturePanelCopy.section)
})
