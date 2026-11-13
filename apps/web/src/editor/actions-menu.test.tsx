import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { actionsOffered, ActionsTool } from "@/editor/actions-menu"

describe("actions menu", () => {
  it("offers Table, the insert the editor already has, and no action it cannot do", () => {
    const onTable = () => undefined
    const offered = actionsOffered({ onTable })
    expect(
      offered.map((group) => ({ label: group.label, names: group.actions.map((action) => action.label) })),
    ).toEqual([{ label: "Insert", names: ["Table"] }])
    expect(offered[0]?.actions[0]?.onSelect).toBe(onTable)
    const markup = renderToStaticMarkup(<ActionsTool onTable={onTable} />)
    expect(markup).toContain('aria-label="Actions"')
  })
})
