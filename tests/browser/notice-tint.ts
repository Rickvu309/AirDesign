import { expect, type Locator } from "@playwright/test"

export async function expectNoticeTint(button: Locator, alpha: number): Promise<void> {
  await expect
    .poll(() =>
      button.evaluate((element) => {
        const canvas = document.createElement("canvas")
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext("2d")
        if (context === null) throw new Error("A canvas context is needed to measure the notice tint")
        context.fillStyle = getComputedStyle(element).backgroundColor
        context.fillRect(0, 0, 1, 1)
        return Array.from(context.getImageData(0, 0, 1, 1).data)
      }),
    )
    .toEqual([255, 255, 255, alpha])
}
