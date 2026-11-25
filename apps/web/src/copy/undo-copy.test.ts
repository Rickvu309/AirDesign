import { expect, it } from "vitest"
import { undoCopy } from "./undo-copy"

it("names the linked chart and gives a way forward when a turn is refused", () => {
  expect(undoCopy.undoRefused).toBe("Unable to undo. The linked chart can’t be restored. Edit the slide directly.")
  expect(undoCopy.redoRefused).toBe("Unable to redo. The linked chart can’t be restored. Edit the slide directly.")
})

it("names the deleted component when a turn skips its update", () => {
  expect(undoCopy.undoSkipped).toBe("Unable to undo the component update. The component was deleted.")
  expect(undoCopy.redoSkipped).toBe("Unable to redo the component update. The component was deleted.")
})
