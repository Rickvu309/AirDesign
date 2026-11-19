import { expect, it } from "vitest"
import { readSetChange } from "./set-wire.js"

it("sets custom dash and gap lengths as percentages of the border width", () => {
  const set = (custom: unknown) => readSetChange({ op: "set", target: "258.2", border: { dash: { custom } } })
  expect(
    set([
      { dash: 350.5, gap: 0 },
      { dash: 150, gap: 45 },
    ]),
  ).toMatchObject({
    ok: true,
    change: {
      border: {
        dash: {
          custom: [
            { dash: 350500, gap: 0 },
            { dash: 150000, gap: 45000 },
          ],
        },
      },
    },
  })
  for (const custom of [[], [{ dash: 0, gap: 20 }], [{ dash: 50 }], [{ dash: 50, gap: -1 }]])
    expect(set(custom)).toEqual({ ok: false, refusal: "field", field: "border.dash" })
})
