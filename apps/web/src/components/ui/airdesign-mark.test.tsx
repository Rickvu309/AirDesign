import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import icon from "../../public/favicon-art.svg?raw"

const strokesOf = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((match) => match[1])

it("draws the mark at the logo's weight, the same strokes as the studio icon", () => {
  expect(strokesOf(renderToStaticMarkup(<AirdesignMark size={20} />))).toEqual(strokesOf(icon))
  expect(strokesOf(icon)).toEqual(["7", "5"])
})
