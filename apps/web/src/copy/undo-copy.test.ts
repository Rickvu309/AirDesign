import { expect, it } from "vitest"
import { undoCopy } from "./undo-copy"

it("names the linked chart and gives a way forward when a turn is refused", () => {
  expect(undoCopy.undoRefused).toBe("Unable to undo. The linked chart can’t be restored. Edit the slide directly.")
  expect(undoCopy.redoRefused).toBe("Unable to redo. The linked chart can’t be restored. Edit the slide directly.")
})
